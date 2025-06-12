import json
import csv

# Đọc dữ liệu JSON từ file
with open('test.json', 'r', encoding='utf-8-sig') as json_file:
    data = json.load(json_file)

# Truy cập vào danh sách training_data
training_data = data.get('training_data', [])

# Tạo file CSV và viết dữ liệu
with open('data.csv', 'w', newline='', encoding='utf-8-sig') as csv_file:
    if training_data:
        # Khởi tạo writer với các trường trong đối tượng của training_data
        writer = csv.DictWriter(csv_file, fieldnames=training_data[0].keys())
        writer.writeheader()
        writer.writerows(training_data)

print("Đã chuyển đổi JSON sang CSV thành công!")
