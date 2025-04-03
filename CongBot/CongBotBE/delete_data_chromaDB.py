import chromadb

client = chromadb.HttpClient(host="localhost", port=8000)

# Lấy danh sách collection (list of str)
collections = client.list_collections()

# Xóa từng collection theo tên
for name in collections:
    client.delete_collection(name=name)
    print(f"Đã xóa collection: {name}")