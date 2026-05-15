FROM node:18-bookworm-slim

# 1. Cài đặt dependencies hệ thống (Chỉ chạy lại khi dòng này bị sửa)
RUN apt-get update && apt-get install -y --no-install-recommends software-properties-common \
    # Thêm contrib để lấy mscorefonts
    && sed -i 's/main$/main contrib/g' /etc/apt/sources.list.d/debian.sources || \
    sed -i 's/main$/main contrib/g' /etc/apt/sources.list \
    && apt-get update \
    # Tự động chấp nhận EULA của Microsoft
    && echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections \
    && apt-get install -y --no-install-recommends \
    # Chỉ cài bản writer để nhẹ hơn
    libreoffice-writer \
    fontconfig \
    ttf-mscorefonts-installer \
    fonts-liberation \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# 2. Cài đặt Node modules (Chỉ chạy lại khi package.json thay đổi)
COPY package*.json ./
RUN npm ci --omit=dev

# 3. Copy code (Chạy thường xuyên nhất, nhưng vì nó ở cuối nên không ảnh hưởng layer trên)
COPY . .

EXPOSE 3000
CMD ["node", "src/server.js"]