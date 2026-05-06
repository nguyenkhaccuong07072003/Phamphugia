# check=skip=FromAsCasing
# === Giai đoạn 1: Build ứng dụng (Môi trường Node.js) ===
# Sử dụng N0de.js phiên bản 22 trên nền Alpine Linux để gọn nhẹ
FROM node:22-alpine AS build-stage

# Đặt thư mục làm việc bên trong container
WORKDIR /app

# Chỉ copy file package.json trước để tận dụng Docker cache (tăng tốc build lần sau)
COPY package*.json ./

# Cài đặt các thư viện (bao gồm cả TypeScript và Vite)
RUN npm install

# Copy toàn bộ mã nguồn Frontend vào container
COPY . .

# Chạy lệnh build của Vite để tạo ra thư mục /dist (các file HTML/JS/CSS tĩnh)
RUN npm run build


# === Giai đoạn 2: Chạy ứng dụng (Môi trường Web Server Nginx) ===
FROM nginx:stable-alpine as production-stage

# 1. Gắn file cấu hình Nginx tùy chỉnh vào đây (PHẦN MỚI THÊM)
# Dòng này sẽ ghi đè file cấu hình mặc định bằng file nginx.conf bạn vừa tạo
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 2. Copy thư mục /dist đã build từ Giai đoạn 1 vào
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Mở cổng 5174
EXPOSE 5174

# Chạy Nginx
CMD ["nginx", "-g", "daemon off;"]