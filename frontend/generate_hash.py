# save as generate_hash.py
from werkzeug.security import generate_password_hash

password = input("Enter password to hash: ")
hashed = generate_password_hash(password)
print("\nHashed password (copy this into your SQL):")
print(hashed)