# 1. Sử dụng môi trường Node.js
FROM node:18-bookworm-slim

# 2. Tạo thư mục làm việc trong máy ảo
WORKDIR /usr/src/app

# 3. Copy file quản lý thư viện vào trước để tối ưu tốc độ build
COPY package*.json ./

# 4. Cài đặt LibreOffice và Font chữ Microsoft
RUN apt-get update && apt-get install -y --no-install-recommends software-properties-common \
    && find /etc/apt -name "*.sources" -exec sed -i 's/Components: main/Components: main contrib/g' {} + \
    && sed -i 's/main$/main contrib/g' /etc/apt/sources.list || true \
    && apt-get update \
    && echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections \
    && apt-get install -y --no-install-recommends \
    libreoffice \
    fontconfig \
    ttf-mscorefonts-installer \
    fonts-liberation \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

# 5. Cài đặt các thư viện Node.js
RUN npm install

# 6. Copy toàn bộ code từ máy bạn vào máy ảo
COPY . .

# 7. Mở cổng 3000 để Express có thể nhận tín hiệu
EXPOSE 3000

# 8. LỆNH CHẠY CHÍNH (Sửa theo đúng đường dẫn của bạn)
CMD ["node", "src/server.js"]