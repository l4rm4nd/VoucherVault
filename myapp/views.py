import qrcode
import io
import base64
import os
import json
import treepoem
import unicodedata
import mimetypes
from django.db.models import Q
from .forms import *
from .models import *
from django.db.models import Sum
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.views.decorators.http import require_GET, require_POST
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from django.contrib import messages
from django.utils.timezone import now
from .decorators import require_authorization_header_with_api_token
from django.db.models import Count, Sum, Q, F, ExpressionWrapper, DecimalField
from django.db.models.functions import Coalesce
from django.db.models import Value

apprise_txt = _('Apprise URLs were already configured. Will not display them again here to protect secrets. You can freely re-configure the URLs now and hit update though.')

def has_item_access(item, user):
    return item.user == user or item.shared_with.filter(shared_with_user=user).exists()

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
def post_logout(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    else:
        return render(request, 'registration/post-logout.html')

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

    # Count the number of items shared by the user
    shared_items_count_by_you = ItemShare.objects.filter(shared_by=user).values('item').distinct().count()
    shared_items_count_with_you = ItemShare.objects.filter(shared_with_user=user).values('item').distinct().count()

    # Get threshold days from environment variable or default to 30
    threshold_days = int(os.getenv('EXPIRY_THRESHOLD_DAYS', 30))
    # Calculate soon-to-expire date
    soon_expiry_date = now() + timedelta(days=threshold_days)
    # Count the number of items soon expiring based on EXPIRY_THRESHOLD_DAYS
    soon_expiring_items = items.filter(expiry_date__gte=now(), expiry_date__lt=soon_expiry_date).count()

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
        "soon_expiring_items": soon_expiring_items,
        'shared_items_count_by_you': shared_items_count_by_you,
        'shared_items_count_with_you': shared_items_count_with_you,
    }
    return render(request, 'dashboard.html', context)

@require_GET
@login_required
def show_items(request):
    user = request.user
    item_type = request.GET.get('type')
    filter_value = request.GET.get('status', 'available')  # Get the combined filter value
    search_query = request.GET.get('query', '')

    # Retrieve or create user preferences
    preferences, _ = UserPreference.objects.get_or_create(user=user)

    # Base query
    if filter_value == 'shared_by_me':
        items = Item.objects.filter(shared_with__shared_by=user).distinct()
    elif filter_value == 'shared_with_me':
        items = Item.objects.filter(shared_with__shared_with_user=user).exclude(user=user).distinct()
    elif filter_value == 'soon_expiring':
        threshold_days = int(os.getenv('EXPIRY_THRESHOLD_DAYS', 30))
        soon_expiry_date = now() + timedelta(days=threshold_days)
        items = Item.objects.filter(user=user, expiry_date__gte=now(), expiry_date__lt=soon_expiry_date)
    else:
        items = Item.objects.filter(user=user)
        
        # Apply additional status filters only to items owned by the user
        if filter_value == 'available':
            own_items = Item.objects.filter(
                user=user,
                is_used=False,
                expiry_date__gte=timezone.now()
            )
            items = (own_items).distinct()
        elif filter_value == 'used':
            items = items.filter(is_used=True)
        elif filter_value == 'expired':
            items = items.filter(expiry_date__lt=timezone.now(), is_used=False)

    # Apply the item_type filter if provided
    if item_type:
        items = items.filter(type=item_type)

    # Apply search query filter if provided
    if search_query:
        items = items.filter(
            Q(name__icontains=search_query) |
            Q(issuer__icontains=search_query)
        )


    # Sort by expiry date, soonest first
    items = items.order_by('expiry_date')

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
        'item_type': item_type,  # Add the item_type to the context
        'item_status': filter_value,  # Reuse item_status to hold the combined filter value
        'search_query': search_query,
        'current_date': timezone.now(),
        'preferences': preferences,
    }
    return render(request, 'inventory.html', context)

@login_required
def view_item(request, item_uuid):
    # Initialize owner flag
    is_owner = False
    
    try:
        # Try to get the item owned by the user
        item = Item.objects.get(id=item_uuid, user=request.user)
        is_owner = True  # Set flag to true if the user is the owner
    except Item.DoesNotExist:
        # If not found, try to get the item shared with the user
        item_share = get_object_or_404(ItemShare, item__id=item_uuid, shared_with_user=request.user)
        item = item_share.item


    # Check if the item has been shared
    is_shared = item.shared_with.exists()

    transactions = item.transactions.all()
    total_value = item.value + sum(t.value for t in transactions)
    
    if request.method == 'POST':
        if not is_owner:
            # Non-owners should not be able to make POST requests (e.g., add transactions)
            return redirect('view_item', item_uuid=item.id)
        
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
        'is_owner': is_owner,  # Pass the owner flag to the template
        'is_shared': is_shared,  # Pass the shared status to the template
    }
    return render(request, 'view-item.html', context)

@login_required
def create_item(request):
    if request.method == 'POST':
        form = ItemForm(request.POST, request.FILES)
        if form.is_valid():
            item = form.save(commit=False)
            item.user = request.user  # Set the user from the session

            buffer = io.BytesIO()
            try:

                if item.code_type != "qrcode" and is_valid_ean13(item.redeem_code):
                    code_type = "ean13"
                    item.code_type = "ean13"
                else:
                    code_type = item.code_type

                if code_type == "qrcode":
                        qr = qrcode.make(item.redeem_code)
                        qr.save(buffer)
                else:
                    barcode = treepoem.generate_barcode(
                        barcode_type=code_type,
                        data=item.redeem_code,
                        scale=2
                    )
                    barcode.save(buffer, 'PNG')

                item.qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
                item.save()  # Save the item after generating the barcode
            except Exception as e:
                # Print the error for debugging and add a user-friendly error to the form
                form.add_error(None, f'Failed to generate barcode. Error: {str(e)}')
                form.add_error(None, f'Use the browser\'s back button to refill previous file uploads')
                # Return the form filled with the user's previously entered data and errors
                return render(request, 'create-item.html', {'form': form})

            # Handle file upload if there's any
            if 'file' in request.FILES:
                file = request.FILES['file']
                username = request.user.username
                user_folder = os.path.join(settings.MEDIA_ROOT, 'uploads', username)
                if not os.path.exists(user_folder):
                    os.makedirs(user_folder)
                file_name = f"{item.id}_{file.name}"
                file_path = os.path.join(user_folder, file_name)
                with open(file_path, 'wb+') as destination:
                    for chunk in file.chunks():
                        destination.write(chunk)
                item.file.name = os.path.join('uploads', username, file_name)
                item.save()

            return redirect('show_items')
        else:
            # If form is not valid, render the form with validation errors
            return render(request, 'create-item.html', {'form': form})
    else:
        # If not a POST request, initialize an empty form
        form = ItemForm()

    return render(request, 'create-item.html', {'form': form})

@login_required
def edit_item(request, item_uuid):
    item = get_object_or_404(Item, id=item_uuid, user=request.user)
    original_redeem_code = item.redeem_code # Store the original redeem code
    original_code_type = item.code_type  # Store the original code type
    old_file_path = item.file.path if item.file else None  # Store the old file path

    if request.method == 'POST':
        form = ItemForm(request.POST, request.FILES, instance=item)
        if form.is_valid():
            item = form.save(commit=False)

            # Check if redeem code has changed
            if original_code_type != item.code_type or original_redeem_code != item.redeem_code:
                # Generate new QR code or barcode and save it as base64
                buffer = io.BytesIO()
                try:
                    if item.code_type != "qrcode" and is_valid_ean13(item.redeem_code):
                        code_type = "ean13"
                        item.code_type = "ean13"
                        item.save()
                    else:
                        code_type = item.code_type

                    if code_type == "qrcode":
                        qr = qrcode.make(item.redeem_code)
                        qr.save(buffer)
                    else:
                        barcode = treepoem.generate_barcode(
                            barcode_type=code_type,
                            data=item.redeem_code,
                            scale=2
                        )
                        barcode.save(buffer, 'PNG')
                    item.qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
                    item.save()  # Save the item after generating the barcode
                except Exception as e:
                    form.add_error(None, f'Failed to generate barcode. Error: {str(e)}')
                    # Return the form filled with the user's previously entered data and errors
                    return render(request, 'edit-item.html', {'form': form, 'item': item})
                    
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

@require_GET
@login_required
def duplicate_item(request, item_uuid):
    original_item = get_object_or_404(Item, id=item_uuid, user=request.user)

    # Prepopulate the form with original item's data
    initial_data = {
        'name': original_item.name,
        'issuer': original_item.issuer,
        'redeem_code': original_item.redeem_code,
        'pin': original_item.pin,
        'issue_date': original_item.issue_date,
        'expiry_date': original_item.expiry_date,
        'description': original_item.description,
        'logo_slug': original_item.logo_slug,
        'type': original_item.type,
        'value': original_item.value,
        'value_type': original_item.value_type,
        'code_type': original_item.code_type,
    }

    form = ItemForm(initial=initial_data)
    return render(request, 'create-item.html', {
        'form': form,
    })

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
    item = get_object_or_404(Item, id=item_id)

    if not has_item_access(item, request.user):
        return HttpResponse("Unauthorized", status=403)

    if item.file:
        file_name = os.path.basename(item.file.name)
        response = HttpResponse(item.file, content_type='application/octet-stream')
        response['Content-Disposition'] = f'attachment; filename="{file_name}"'
        return response
    else:
        return HttpResponse("No file found", status=404)

@require_GET
@login_required
def serve_image_file(request, item_id):
    item = get_object_or_404(Item, id=item_id)

    if not has_item_access(item, request.user):
        return HttpResponse("Unauthorized", status=403)

    if not item.file:
        raise Http404("No file attached.")

    mime_type, _ = mimetypes.guess_type(item.file.name)
    if not mime_type or not mime_type.startswith('image/'):
        return HttpResponse("File is not an image", status=400)

    return HttpResponse(item.file, content_type=mime_type)      

@require_POST
@login_required
def toggle_item_status(request, item_id):
    item = get_object_or_404(Item, id=item_id, user=request.user)
    desc_txt = _('Marked as used, removing remaining value')

    if item.is_used:
        # If item is currently marked as used, re-toggle to available
        item.is_used = False

        # Remove the previously created "Mark as used" transaction
        transaction = Transaction.objects.filter(item=item, description=desc_txt).all()
        if transaction:
            transaction.delete()
    else:
        # If item is available, mark as used and create a transaction
        item.is_used = True
        transactions = item.transactions.all()
        value_to_remove = item.value + sum(t.value for t in transactions)

        transaction = Transaction(
            item=item,
            description=desc_txt,
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
            
            if apprise_urls != apprise_txt:
                user_profile.apprise_urls = apprise_urls
                form.save()
            return redirect('show_items')  # Redirect to 'show_items' after saving
    else:
        # Mask the apprise_urls in the form
        initial_data = {
            'apprise_urls': apprise_txt if user_profile.apprise_urls else '',
        }
        form = UserProfileForm(instance=user_profile, initial=initial_data)
    return render(request, 'update_apprise_urls.html', {'form': form})

@require_POST
@login_required
def verify_apprise_urls(request):
    data = json.loads(request.body)
    apprise_urls = data.get('apprise_urls', '')
    apprise_error_msg = _('No Apprise URLs provided.')

    # if the user sent no apprise urls
    if not apprise_urls:
        return JsonResponse({'success': False, 'message': apprise_error_msg})

    # if the user just wants to test the previously configured apprise urls
    if apprise_urls == apprise_txt:
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
        apprise_error_msg = _('Invalid Apprise URLs:')
        return JsonResponse({'success': False, 'message': f'{apprise_error_msg}: {", ".join(invalid_urls)}'})

    # Send a test notification if all URLs are valid
    try:
        msg_body = _('This is an Apprise test notification.')
        msg_title = _('Test Notification by VoucherVault')
        msg_success = _('Test notification to at least one Apprise URL sent successfully.')
        msg_failure = _('Failed to send test notification for every Apprise URL given.')

        success = apobj.notify(
            body=msg_body,
            title=msg_title,
            notify_type=apprise.NotifyType.INFO
        )

        if success:
            return JsonResponse({'success': True, 'message': msg_success})
        else:
            return JsonResponse({'success': False, 'message': msg_failure})
        
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Failed to send test notification: {str(e)}'})

@require_GET
@login_required
def sharing_center(request):
    current_user = request.user

    shares = ItemShare.objects.filter(
        Q(shared_with_user=current_user) | Q(shared_by=current_user)
    ).select_related('item', 'shared_by', 'shared_with_user') \
     .order_by('item__expiry_date')

    unique_items = {}

    for share in shares:
        item = share.item
        if item.id not in unique_items:
            if share.shared_with_user == current_user:
                # You are the receiver
                unique_items[item.id] = {
                    'item': item,
                    'qr_code_base64': item.qr_code_base64,
                    'shared_by': share.shared_by,
                    'shared_with_me': True
                }
            elif share.shared_by == current_user:
                # You are the sender
                unique_items[item.id] = {
                    'item': item,
                    'qr_code_base64': item.qr_code_base64,
                    'shared_with_me': False
                }

    shared_items = list(unique_items.values())

    return render(request, 'sharing_center.html', {
        'shared_items': shared_items,
        'current_date': timezone.now(),
    })

@login_required
def share_item_view(request, item_id):
    item = get_object_or_404(Item, id=item_id, user=request.user)

    if request.method == 'POST':
        selected_users = request.POST.getlist('shared_users')
        if selected_users:
            for user_id in selected_users:
                recipient = User.objects.get(id=user_id)
                ItemShare.objects.get_or_create(item=item, shared_with_user=recipient, shared_by=request.user)
            messages.success(request, _('Item shared successfully!'))
        else:
            messages.error(request, _('Please select at least one user to share with.'))

        return redirect('view_item', item_uuid=item.id)

    users = User.objects.exclude(id=request.user.id)
    return render(request, 'share_item.html', {'item': item, 'users': users})

@require_POST
@login_required
def unshare_item(request, item_id, user_id):
    # Get the item and ensure the current user is the owner
    item = get_object_or_404(Item, id=item_id, user=request.user)
    
    # Find the ItemShare record for the specified user
    item_share = get_object_or_404(ItemShare, item=item, shared_with_user__id=user_id)

    # Delete the ItemShare record to unshare the item
    item_share.delete()
    
    # Display a success message
    messages.success(request, _("Item has been unshared successfully."))
    
    # Redirect back to the item view page
    return redirect('view_item', item_uuid=item.id)

# API

@require_authorization_header_with_api_token

def get_items_by_type(request, item_type):
    authenticate_general_api_key(request)
    items = Item.objects.filter(type=item_type).values()
    return JsonResponse(list(items), safe=False)

@require_authorization_header_with_api_token
def get_stats(request):
    # Optional filter for username
    username = request.GET.get('user', None)

    # Get threshold days from environment variable or default to 30
    threshold_days = int(os.getenv('EXPIRY_THRESHOLD_DAYS', 30))

    # Calculate soon-to-expire date
    soon_expiry_date = now() + timedelta(days=threshold_days)
    
    # If a username is provided, filter by user
    if username:
        user = get_object_or_404(User, username=username)
        items_query = Item.objects.filter(user=user)
    else:
        # If no username is provided, use all items
        items_query = Item.objects.all()

    # Calculate the total value of active, unused, and non-expired items, considering transactions
    items_with_transaction_values = (
        items_query.filter(is_used=False, expiry_date__gte=now())  # Exclude used and expired items
        .annotate(
            transaction_total=Sum('transactions__value', default=0)  # Sum of related transaction values
        )
        .annotate(net_value=ExpressionWrapper(F('value') + F('transaction_total'), output_field=models.DecimalField()))
    )

    total_value = round((items_with_transaction_values.aggregate(total_value=Sum('net_value'))['total_value'] or 0), 2)

    # Item stats
    item_stats = {
        "total_items": items_query.count(),
        "total_value": total_value,  # Net value only for valid items
        "vouchers": items_query.filter(type='voucher').count(),
        "giftcards": items_query.filter(type='giftcard').count(),
        "coupons": items_query.filter(type='coupon').count(),
        "loyaltycards": items_query.filter(type='loyaltycard').count(),
        "used_items": items_query.filter(is_used=True).count(),
        "available_items": items_query.filter(is_used=False).count() - items_query.filter(expiry_date__lt=now()).count(),
        "expired_items": items_query.filter(expiry_date__lt=now()).count(),
        "soon_expiring_items": items_query.filter(expiry_date__gte=now(), expiry_date__lt=soon_expiry_date).count(),
    }

    # User stats
    user_stats = {
        "total_users": User.objects.count(),
        "active_users": User.objects.filter(is_active=True).count(),
        "disabled_users": User.objects.filter(is_active=False).count(),
        "superusers": User.objects.filter(is_superuser=True).count(),
        "staff_members": User.objects.filter(is_staff=True).count(),
    }

    # Calculate the total transaction values per issuer
    issuer_transaction_totals = (
        items_query.filter(is_used=False, expiry_date__gte=now())  # Only active, non-expired items
        .values('issuer')
        .annotate(
            transaction_total=Coalesce(
                Sum('transactions__value', output_field=DecimalField()), 
                Value(0, output_field=DecimalField())
            )  # Sum of transaction values with output field defined
        )
    )

    # Map issuer to transaction totals for easier lookup
    issuer_transaction_map = {item['issuer']: item['transaction_total'] for item in issuer_transaction_totals}

    # Calculate issuer stats with count and base value
    issuers = (
        items_query.filter(is_used=False, expiry_date__gte=now())  # Only active, non-expired items
        .values('issuer')
        .annotate(
            count=Count('issuer'),
            base_value=Coalesce(
                Sum('value', output_field=DecimalField()), 
                Value(0, output_field=DecimalField())
            )  # Sum of item values with output field defined
        )
        .order_by('-count')  # Optional: order by count
    )

    # Combine the values and transactions for the final total
    issuer_stats = [
        {
            "issuer": issuer["issuer"],
            "count": issuer["count"],
            "total_value": round((issuer["base_value"] + issuer_transaction_map.get(issuer["issuer"], 0)), 2),  # Add base and transaction totals
        }
        for issuer in issuers
    ]

    # Combine both stats into one response
    return JsonResponse({
        "item_stats": item_stats,
        "user_stats": user_stats,
        "issuer_stats": issuer_stats,
    })

@login_required
def update_user_preferences(request):
    preferences, _ = UserPreference.objects.get_or_create(user=request.user)

    if request.method == 'POST':
        form = UserPreferenceForm(request.POST, instance=preferences)
        if form.is_valid():
            form.save()
            return redirect('show_items')  # or redirect to 'update_user_preferences' to stay on page
    else:
        form = UserPreferenceForm(instance=preferences)

    return render(request, 'update_preferences.html', {'form': form})
