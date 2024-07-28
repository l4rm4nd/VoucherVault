import unicodedata

def generate_username(email):
    # Normalize the email and slice at 150 characters
    return unicodedata.normalize('NFKC', email)[:150]