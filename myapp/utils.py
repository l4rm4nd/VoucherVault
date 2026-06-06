import unicodedata
import urllib.request
import urllib.error
import json
import logging

logger = logging.getLogger(__name__)

def generate_username(email):
    # Normalize the email
    normalized_email = unicodedata.normalize('NFKC', email)
    # Split the email to get the username part
    username_part = normalized_email.split('@')[0]
    # Slice the username to a maximum of 150 characters
    return username_part[:150]


def get_fixer_rates(api_key):
    """
    Fetch latest exchange rates from Fixer.io (EUR base, free plan).
    Returns a dict of {currency_code: rate} or None on failure.
    """
    url = f"http://data.fixer.io/api/latest?access_key={api_key}"
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            data = json.loads(response.read().decode())
        if not data.get('success'):
            logger.warning("Fixer.io API error: %s", data.get('error'))
            return None
        return data.get('rates', {})
    except (urllib.error.URLError, Exception) as exc:
        logger.warning("Fixer.io request failed: %s", exc)
        return None


def convert_currency(amount, from_currency, to_currency, rates):
    """
    Convert amount from from_currency to to_currency using EUR-based rates dict.
    Returns the converted amount as float, or None if a rate is missing.
    """
    if from_currency == to_currency:
        return float(amount)
    rate_from = rates.get(from_currency)
    rate_to = rates.get(to_currency)
    if not rate_from or not rate_to:
        return None
    # rates are relative to EUR: amount_in_eur = amount / rate_from
    # amount_in_target = amount_in_eur * rate_to
    return float(amount) / rate_from * rate_to
