# Geo Tagging App - Hướng Dẫn Chạy

Repository này gồm:
- `backend/`: FastAPI + MySQL + retrieval Qdrant (tùy chọn)
- `frontend/`: React + Vite

Tài liệu này hướng dẫn chạy:
- Backend (BE)
- Frontend (FE)
- Qdrant bang Docker
- MySQL local

## 1) Điều Kiện Cần

Các công cụ cần cài trước:
- Python 3.10+ (khuyến nghị 3.10 hoặc 3.11)
- Node.js 18+
- npm 9+
- Docker
- MySQL 8+

## 2) Khởi Động MySQL (Local)

Đảm bảo MySQL đang chạy tại `127.0.0.1:3306`.

Ví dụ trên Linux:

```bash
sudo systemctl start mysql
sudo systemctl status mysql
```

Tạo database và bảng từ file schema:

```bash
cd backend
mysql -u root -p < schema.sql
```

Nếu muốn tạo user riêng cho dự án (tùy chọn):

```sql
CREATE USER 'geotag'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON geotagging.* TO 'geotag'@'localhost';
FLUSH PRIVILEGES;
```

## 3) Khởi Động Qdrant (Docker Container)

Chạy Qdrant local:

```bash
docker run -d \
  --name geotag-qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

Kiểm tra health:

```bash
curl http://localhost:6333/health
```

Lệnh hay dùng:

```bash
docker logs -f geotag-qdrant
docker stop geotag-qdrant
docker start geotag-qdrant
```

## 4) Cấu Hình Và Chạy Backend

Mở terminal trong thư mục `backend/`:

```bash
cd backend
```

Tạo và kích hoạt virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Cài dependencies:

```bash
pip install -r requirements.txt
```

Tạo file `.env` từ template:

```bash
cp .env.example .env
```

Cập nhật `backend/.env` với giá trị local của bạn. Tối thiểu:

```env
DATABASE_URL=mysql+pymysql://<mysql_user>:<mysql_password>@127.0.0.1:3306/geotagging?charset=utf8mb4
QDRANT_URL=http://localhost:6333
USE_RETRIEVAL=true
ENABLE_REAL_MODELS=false
INFERENCE_BACKEND=modal
```

Chạy backend API:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Kiểm tra health:

```bash
curl http://localhost:8000/health
```

## 5) Cấu Hình Và Chạy Frontend

Mở terminal khác trong `frontend/`:

```bash
cd frontend
npm install
```

Tạo file env cho frontend:

```bash
cat > .env.local << 'EOF'
VITE_API_BASE_URL=http://localhost:8000
EOF
```

Chạy frontend:

```bash
npm run dev
```

Vite thường chạy tại:
- `http://localhost:5173`

## 6) Thứ Tự Khởi Động Đề Xuất

1. Khởi động MySQL
2. Khởi động container Qdrant
3. Chạy backend (`uvicorn`)
4. Chạy frontend (`npm run dev`)

## 7) Ghi Chú Tùy Chọn

- Nếu bạn không muốn bật retrieval, set trong `backend/.env`:

```env
USE_RETRIEVAL=false
```

- Nếu sử dụng Modal inference bên ngoài, set thêm:

```env
MODAL_INFER_URL=<your_modal_predict_url>
MODAL_HEALTH_URL=<your_modal_health_url>
```

- Ảnh upload được backend phục vụ qua đường dẫn `/uploads`.

## 8) Xử Lý Lỗi Thường Gặp

- Lỗi kết nối MySQL:
  - Kiểm tra MySQL đã chạy và `DATABASE_URL` đúng.
  - Chạy lại `mysql -u root -p < schema.sql` nếu thiếu schema.

- Backend không kết nối được Qdrant:
  - Kiểm tra container đang chạy: `docker ps`
  - Kiểm tra endpoint: `http://localhost:6333/health`

- Frontend không gọi được backend:
  - Kiểm tra `VITE_API_BASE_URL` trong `frontend/.env.local`
  - Đảm bảo backend đang chạy cổng `8000`
