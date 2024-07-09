from django.http import HttpResponse
from .decorators import auth_required
from django.shortcuts import render, redirect, get_object_or_404
from django.views.decorators.http import require_GET, require_POST
from .models import Item
import qrcode
import io
import base64
from django.db.models import Q
from .forms import *
from .models import *
from django.db.models import Sum
from django.utils import timezone

@require_GET
@auth_required
def dashboard(request):
    user = request.user
    total_items = Item.objects.filter(user=user, is_used=False).count()
    available_items = Item.objects.filter(user=user, is_used=False, expiry_date__gte=timezone.now()).count()
    used_items = Item.objects.filter(user=user, is_used=True).count()
    total_value = Item.objects.filter(user=user, is_used=False, expiry_date__gte=timezone.now()).aggregate(total_value=Sum('value'))['total_value'] or 0
    coupons_count = Item.objects.filter(user=user, type='coupon', is_used=False, expiry_date__gte=timezone.now()).count()
    vouchers_count = Item.objects.filter(user=user, type='voucher', is_used=False, expiry_date__gte=timezone.now()).count()
    giftcards_count = Item.objects.filter(user=user, type='giftcard', is_used=False, expiry_date__gte=timezone.now()).count()
    expired_items = Item.objects.filter(user=user, expiry_date__lt=timezone.now(), is_used=False).count()

    context = {
        'total_items': total_items,
        'available_items': available_items,
        'used_items': used_items,
        'total_value': total_value,
        'coupons_count': coupons_count,
        'vouchers_count': vouchers_count,
        'giftcards_count': giftcards_count,
        'expired_items': expired_items,
    }
    return render(request, 'dashboard.html', context)

@require_GET
@auth_required
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
        qr = qrcode.make(item.redeem_code)
        buffer = io.BytesIO()
        qr.save(buffer)
        qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
        items_with_qr.append({
            'item': item,
            'qr_code_base64': qr_code_base64,
        })

    context = {
        'items_with_qr': items_with_qr,
        'item_type': item_type,
        'item_status': item_status,
        'search_query': search_query,
        'current_date': timezone.now(),
    }
    return render(request, 'show-item.html', context)

@auth_required
def create_item(request):
    if request.method == 'POST':
        form = ItemForm(request.POST)
        if form.is_valid():
            item = form.save(commit=False)
            item.user = request.user  # Set the user from the session
            item.save()
            return redirect('show_items')
    else:
        form = ItemForm()
    
    return render(request, 'create-item.html', {'form': form})

@require_GET
@auth_required
def view_item(request, item_uuid):
    item = get_object_or_404(Item, id=item_uuid, user=request.user)
    
    # Generate QR code
    qr = qrcode.make(item.redeem_code)
    buffer = io.BytesIO()
    qr.save(buffer)
    qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    context = {
        'item': item,
        'qr_code_base64': qr_code_base64,
        'current_date': timezone.now(),
    }
    return render(request, 'view-item.html', context)

@require_POST
@auth_required
def delete_item(request, item_uuid):
    item = get_object_or_404(Item, id=item_uuid, user=request.user)
    item.delete()
    return redirect('show_items')

@auth_required
def edit_item(request, item_uuid):
    item = get_object_or_404(Item, id=item_uuid, user=request.user)
    if request.method == 'POST':
        form = ItemForm(request.POST, instance=item)
        if form.is_valid():
            form.save()
            return redirect('view_item', item_uuid=item.id)
    else:
        form = ItemForm(instance=item)
    return render(request, 'edit-item.html', {'form': form, 'item': item})

@require_POST
@auth_required
def mark_as_used(request, item_uuid):
    item = get_object_or_404(Item, id=item_uuid, user=request.user)
    item.is_used = True  # Assuming you have an is_used field in your Item model
    item.save()
    return redirect('view_item', item_uuid=item.id)

@require_POST
@auth_required
def toggle_item_status(request, item_id):
    item = get_object_or_404(Item, id=item_id, user=request.user)
    item.is_used = not item.is_used
    item.save()
    return redirect('view_item', item.id)

@auth_required
def update_apprise_urls(request):
    user_profile = request.user.userprofile
    if request.method == 'POST':
        form = UserProfileForm(request.POST, instance=user_profile)
        if form.is_valid():
            form.save()
            return redirect('dashboard')  # Redirect to a profile page or another page after saving
    else:
        form = UserProfileForm(instance=user_profile)
    return render(request, 'update_apprise_urls.html', {'form': form})