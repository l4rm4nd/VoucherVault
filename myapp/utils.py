import unicodedata

def generate_username(email):
    # Normalize the email
    normalized_email = unicodedata.normalize('NFKC', email)
    # Split the email to get the username part
    username_part = normalized_email.split('@')[0]
    # Slice the username to a maximum of 150 characters
    return username_part[:150]