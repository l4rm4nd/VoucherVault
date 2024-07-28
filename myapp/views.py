from django.http import HttpResponse
#from .decorators import auth_required
from django.shortcuts import render, redirect, get_object_or_404
from django.views.decorators.http import require_GET, require_POST
from .models import Item
import qrcode
import io
import base64
import os
from django.db.models import Q
from .forms import *
from .models import *
from django.db.models import Sum
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
import json
import treepoem
from django.conf import settings
import unicodedata

def calculate_ean13_check_digit(code):
    # Calculate the EAN-13 check digit
    sum_odd = sum(int(code[i]) for i in range(0, 12, 2))
    sum_even = sum(int(code[i]) for i in range(1, 12, 2))
    checksum = (sum_odd + 3 * sum_even) % 10
    return (10 - checksum) % 10

def is_valid_ean13(code):
    if len(code) != 13 or not code.isdigit():
        return False
    return int(code[-1]) == calculate_ean13_check_digit(code)

@require_GET
@login_required
def dashboard(request):
    user = request.user
    total_items = Item.objects.filter(user=user, is_used=False).count()
    available_items = Item.objects.filter(user=user, is_used=False, expiry_date__gte=timezone.now()).count()
    used_items = Item.objects.filter(user=user, is_used=True).count()
    expired_items = Item.objects.filter(user=user, expiry_date__lt=timezone.now(), is_used=False).count()

    # Calculate the current total value of available items
    items = Item.objects.filter(user=user, is_used=False, value_type='money', expiry_date__gte=timezone.now())
    items = items.exclude(type='loyaltycard')
    total_value = 0
    for item in items:
        transactions_sum = Transaction.objects.filter(item=item).aggregate(Sum('value'))['value__sum'] or 0
        current_value = item.value + transactions_sum
        total_value += current_value

    coupons_count = Item.objects.filter(user=user, type='coupon', is_used=False, expiry_date__gte=timezone.now()).count()
    vouchers_count = Item.objects.filter(user=user, type='voucher', is_used=False, expiry_date__gte=timezone.now()).count()
    giftcards_count = Item.objects.filter(user=user, type='giftcard', is_used=False, expiry_date__gte=timezone.now()).count()
    loyaltycards_count = Item.objects.filter(user=user, type='loyaltycard', is_used=False, expiry_date__gte=timezone.now()).count()

    context = {
        'total_items': total_items,
        'available_items': available_items,
        'used_items': used_items,
        'total_value': total_value,
        'coupons_count': coupons_count,
        'vouchers_count': vouchers_count,
        'giftcards_count': giftcards_count,
        'loyaltycards_count':loyaltycards_count,
        'expired_items': expired_items,
        'container_version': settings.VERSION,
    }
    return render(request, 'dashboard.html', context)

@require_GET
@login_required
def show_items(request):
    user = request.user
    item_type = request.GET.get('type')
    item_status = request.GET.get('status', 'available')  # Default to 'available'
    search_query = request.GET.get('query', '')

    items = Item.objects.filter(user=user)

    if item_type:
        items = items.filter(type=item_type)

    if item_status:
        if item_status == 'available':
            items = items.filter(is_used=False, expiry_date__gte=timezone.now())
        elif item_status == 'used':
            items = items.filter(is_used=True)
        elif item_status == 'expired':
            items = items.filter(expiry_date__lt=timezone.now())

    if search_query:
        items = items.filter(
            Q(name__icontains=search_query) |
            Q(issuer__icontains=search_query)
        )
    
    items_with_qr = []

    for item in items:       
        # Calculate current value
        transactions_sum = Transaction.objects.filter(item=item).aggregate(Sum('value'))['value__sum'] or 0
        current_value = item.value + transactions_sum

        items_with_qr.append({
            'item': item,
            'qr_code_base64': item.qr_code_base64,
            'current_value': current_value,
        })

    context = {
        'items_with_qr': items_with_qr,
        'item_type': item_type,
        'item_status': item_status,
        'search_query': search_query,
        'current_date': timezone.now(),
        'container_version': settings.VERSION,
    }
    return render(request, 'inventory.html', context)

@login_required
def view_item(request, item_uuid):
    item = get_object_or_404(Item, id=item_uuid, user=request.user)
    transactions = item.transactions.all()
    total_value = item.value + sum(t.value for t in transactions)
    
    if request.method == 'POST':
        form = TransactionForm(request.POST, item=item)
        if form.is_valid():
            transaction = form.save(commit=False)
            transaction.item = item
            transaction.save()
            total_value += transaction.value
            
            if total_value <= 0:
                item.is_used = True
                item.save()
            return redirect('view_item', item_uuid=item.id)
    else:
        form = TransactionForm(item=item)
    
    context = {
        'item': item,
        'transactions': transactions,
        'total_value': total_value,
        'qr_code_base64': item.qr_code_base64,
        'form': form,
        'current_date': timezone.now(),
        'container_version': settings.VERSION,
    }
    return render(request, 'view-item.html', context)


@login_required
def create_item(request):
    if request.method == 'POST':
        form = ItemForm(request.POST, request.FILES)
        if form.is_valid():
            item = form.save(commit=False)
            item.user = request.user  # Set the user from the session

            # Save the item first to generate the ID
            item.save()

            # Generate QR code or barcode and save it as base64
            buffer = io.BytesIO()
            if is_valid_ean13(item.redeem_code):
                barcode = treepoem.generate_barcode(
                    barcode_type='ean13',  # Specify the barcode type
                    data=item.redeem_code
                )
                barcode.save(buffer, 'PNG')
            else:
                qr = qrcode.make(item.redeem_code)
                qr.save(buffer)

            item.qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()

            # Handle file upload
            if 'file' in request.FILES:
                file = request.FILES['file']
                username = request.user.username
                user_folder = os.path.join(settings.MEDIA_ROOT, 'uploads', username)
                if not os.path.exists(user_folder):
                    os.makedirs(user_folder)
                file_name = f"{item.id}_{file.name}"
                file_path = os.path.join(user_folder, file_name)
                item.file.save(file_path, file)

            item.save()
            return redirect('show_items')
    else:
        form = ItemForm()

    return render(request, 'create-item.html', {'form': form})

@login_required
def edit_item(request, item_uuid):
    item = get_object_or_404(Item, id=item_uuid, user=request.user)
    original_redeem_code = item.redeem_code  # Store the original redeem code
    old_file_path = item.file.path if item.file else None  # Store the old file path

    if request.method == 'POST':
        form = ItemForm(request.POST, request.FILES, instance=item)
        if form.is_valid():
            item = form.save(commit=False)

            # Check if redeem code has changed
            if original_redeem_code != item.redeem_code:
                # Generate new QR code or barcode and save it as base64
                buffer = io.BytesIO()
                if is_valid_ean13(item.redeem_code):
                    barcode = treepoem.generate_barcode(
                        barcode_type='ean13',  # Specify the barcode type
                        data=item.redeem_code
                    )
                    barcode.save(buffer, 'PNG')
                else:
                    qr = qrcode.make(item.redeem_code)
                    qr.save(buffer)
                
                item.qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()

            # Handle file upload
            if 'file' in request.FILES:
                file = request.FILES['file']
                username = request.user.username
                user_folder = os.path.join(settings.MEDIA_ROOT, 'uploads', username)
                if not os.path.exists(user_folder):
                    os.makedirs(user_folder)
                file_name = f"{item.id}_{file.name}"
                file_path = os.path.join(user_folder, file_name)

                # Delete the old file if it exists and a new file is provided
                if old_file_path and os.path.isfile(old_file_path):
                    os.remove(old_file_path)

                # Save the new file
                item.file.save(file_path, file)

            item.save()
            return redirect('view_item', item_uuid=item.id)
    else:
        form = ItemForm(instance=item)

    return render(request, 'edit-item.html', {'form': form, 'item': item})

@require_POST
@login_required
def delete_item(request, item_uuid):
    item = get_object_or_404(Item, id=item_uuid, user=request.user)

    # Delete the associated file if it exists
    if item.file:
        if os.path.isfile(item.file.path):
            os.remove(item.file.path)

    item.delete()
    return redirect('show_items')

@require_POST
@login_required
def delete_transaction(request, transaction_id):
    transaction = get_object_or_404(Transaction, id=transaction_id)
    item = transaction.item
    # Delete the transaction
    transaction.delete()

    return redirect('view_item', item_uuid=item.id)

@require_GET
@login_required
def download_file(request, item_id):
    item = get_object_or_404(Item, id=item_id, user=request.user)
    if item.file:
        file_name = os.path.basename(item.file.name)
        response = HttpResponse(item.file, content_type='application/octet-stream')
        response['Content-Disposition'] = f'attachment; filename="{file_name}"'
        return response
    else:
        return HttpResponse("No file found", status=404)

@require_POST
@login_required
def toggle_item_status(request, item_id):
    item = get_object_or_404(Item, id=item_id, user=request.user)
    
    if item.is_used:
        # If item is currently marked as used, re-toggle to available
        item.is_used = False

        # Remove the previously created "Mark as used" transaction
        transaction = Transaction.objects.filter(item=item, description='Marked as used, removing remaining value').all()
        if transaction:
            transaction.delete()
    else:
        # If item is available, mark as used and create a transaction
        item.is_used = True
        transactions = item.transactions.all()
        value_to_remove = item.value + sum(t.value for t in transactions)

        transaction = Transaction(
            item=item,
            description='Marked as used, removing remaining value',
            value=-value_to_remove  # This will be a negative value to reduce the item value
        )
        transaction.save()
    
    item.save()
    return redirect('view_item', item_uuid=item.id)

@login_required
def update_apprise_urls(request):
    user_profile = request.user.userprofile
    if request.method == 'POST':
        form = UserProfileForm(request.POST, instance=user_profile)
        if form.is_valid():
            apprise_urls = form.cleaned_data['apprise_urls']
            if apprise_urls != 'Apprise URLs were already configured. Will not display them again here to protect secrets. You can freely re-configure the URLs now and hit update though.':
                user_profile.apprise_urls = apprise_urls
                form.save()
            return redirect('show_items')  # Redirect to 'show_items' after saving
    else:
        # Mask the apprise_urls in the form
        initial_data = {
            'apprise_urls': 'Apprise URLs were already configured. Will not display them again here to protect secrets. You can freely re-configure the URLs now and hit update though.' if user_profile.apprise_urls else ''
        }
        form = UserProfileForm(instance=user_profile, initial=initial_data)
    return render(request, 'update_apprise_urls.html', {'form': form})

@require_POST
@login_required
def verify_apprise_urls(request):
    data = json.loads(request.body)
    apprise_urls = data.get('apprise_urls', '')

    # if the user sent no apprise urls
    if not apprise_urls:
        return JsonResponse({'success': False, 'message': 'No Apprise URLs provided.'})

    # if the user just wants to test the previously configured apprise urls
    if apprise_urls == "Apprise URLs were already configured. Will not display them again here to protect secrets. You can freely re-configure the URLs now and hit update though.":
        user_settings = get_object_or_404(UserProfile, user=request.user)
        apprise_urls = user_settings.apprise_urls

    # obtain the individual apprise urls
    apprise_urls = apprise_urls.split(',')
    apobj = apprise.Apprise()
    invalid_urls = []

    for url in apprise_urls:
        url = url.strip()
        try:
            apobj.add(url)
        except apprise.AppriseAssetException:
            invalid_urls.append(url)

    if invalid_urls:
        return JsonResponse({'success': False, 'message': f'Invalid Apprise URLs: {", ".join(invalid_urls)}'})

    # Send a test notification if all URLs are valid
    try:
        success = apobj.notify(
            body='This is an Apprise test notification.',
            title='Test Notification by VoucherVault',
            notify_type=apprise.NotifyType.INFO
        )
        if success:
            return JsonResponse({'success': True, 'message': 'Test notification to at least one Apprise URL sent successfully.'})
        else:
            return JsonResponse({'success': False, 'message': 'Failed to send test notification for every Apprise URL given.'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Failed to send test notification: {str(e)}'})