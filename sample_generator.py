"""
sample_generator.py
--------------------
Generates a synthetic "Employee Records" dataset with intentionally
injected duplicates, so the demo has something interesting to detect:

  - Exact duplicates (identical row copied again)
  - Case/whitespace-variant duplicates ("John Doe" vs " john doe ")
  - Genuinely unique records
"""

import random

FIRST_NAMES = ["Aarav", "Vivaan", "Ishaan", "Ananya", "Diya", "Kabir",
               "Meera", "Rohan", "Sara", "Aditya", "Priya", "Karan",
               "Neha", "Arjun", "Tanya", "Yash", "Riya", "Dev"]
LAST_NAMES = ["Sharma", "Verma", "Iyer", "Khan", "Nair", "Gupta",
              "Reddy", "Singh", "Rao", "Mehta", "Das", "Chopra"]
DEPARTMENTS = ["Engineering", "Sales", "HR", "Finance", "Marketing", "Support"]


def _make_record(emp_id: int) -> dict:
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    name = f"{first} {last}"
    email = f"{first.lower()}.{last.lower()}{emp_id}@company.com"
    phone = f"9{random.randint(100000000, 999999999)}"
    dept = random.choice(DEPARTMENTS)
    return {
        "EmpID": str(emp_id),
        "Name": name,
        "Email": email,
        "Phone": phone,
        "Department": dept,
    }


def generate_dataset(num_unique: int = 60, duplicate_ratio: float = 0.35,
                      seed: int = 42) -> list:
    random.seed(seed)
    records = [_make_record(1000 + i) for i in range(num_unique)]

    num_duplicates = int(num_unique * duplicate_ratio)
    for _ in range(num_duplicates):
        original = random.choice(records)
        variant = dict(original)
        if random.random() < 0.5:
            # exact duplicate
            records.append(variant)
        else:
            # case/whitespace-variant duplicate (still a "duplicate"
            # once fields are normalized by the detector)
            variant["Name"] = f"  {variant['Name'].upper()}  "
            variant["Email"] = variant["Email"].upper()
            records.append(variant)

    random.shuffle(records)
    return records
