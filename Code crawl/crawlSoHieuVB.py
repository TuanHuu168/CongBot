import requests
import json
import pandas as pd

# URL gốc
base_url = "https://portalapi.molisa.gov.vn/api/Public/VanBan"

# Các tham số cố định
params = {
    "lang": "vi",
    "take": 100,
    "requireTotalCount": "true",
    "filter": json.dumps([["LopVanBanID", "=", "104"], "and", ["LinhVucID", "=", "6897"]])
}

# Danh sách lưu trữ kết quả
documents = []

# Bắt đầu với skip = 0
skip = 0
while True:
    params["skip"] = skip
    
    response = requests.get(base_url, params=params)
    
    if response.status_code != 200:
        print(f"Lỗi khi gửi request: {response.status_code}")
        break
    
    data = response.json()
    # print("Số lượng văn bản trả về:", len(data.get("data", [])))
    # print("Dữ liệu trả về:", data.get("data"))
    # input()
    
    if not data.get("data", []):  # Nếu không có dữ liệu, thoát vòng lặp
        break
    
    documents.extend({"Số ký hiệu": item["SoKyHieu"], "Tên văn bản": item.get("TrichYeu", "")}
                     for item in data.get("data", []) if "SoKyHieu" in item)
    
    skip += params["take"]

# In danh sách kết quả
df = pd.DataFrame(documents)
df.to_csv("soHieuVanBan.csv", index=False, encoding="utf-8-sig")
print("Đã lưu file soHieuVanBan.csv")
