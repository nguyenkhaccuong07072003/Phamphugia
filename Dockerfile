# 1. Sử dụng môi trường Node.js
FROM node:18-alpine

# 2. Tạo thư mục làm việc trong máy ảo
WORKDIR /usr/src/app

# 3. Copy file quản lý thư viện vào trước để tối ưu tốc độ build
COPY package*.json ./

# 4. Cài đặt các thư viện (dependencies)
RUN npm install

# 5. Copy toàn bộ code từ máy bạn vào máy ảo
COPY . .

# 6. Mở cổng 3000 để Express có thể nhận tín hiệu
EXPOSE 3001

# 7. LỆNH CHẠY CHÍNH (Sửa theo đúng đường dẫn của bạn)
CMD ["node", "src/server.js"]