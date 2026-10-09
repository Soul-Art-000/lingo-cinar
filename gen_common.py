import re
from wordfreq import zipf_frequency

with open("www/words.js", "r", encoding="utf-8") as f:
    content = f.read()

# Extract the big string
match = re.search(r'Set\("([^"]+)"', content)
words = match.group(1).split(" ")

print(f"Total TDK words: {len(words)}")

common = []
for w in words:
    lower_w = w.replace("I", "ı").replace("İ", "i").lower()
    freq = zipf_frequency(lower_w, 'tr')
    # Zipf frequency > 3.0 usually means common enough for humans to know.
    if freq >= 3.5:
        common.append(w)

print(f"Common words (freq >= 3.5): {len(common)}")

# Save to a new JS variable in words.js
new_content = content + f'\nconst COMMON = "{ " ".join(common) }".split(" ");\n'
with open("www/words.js", "w", encoding="utf-8") as f:
    f.write(new_content)

