<script setup lang="ts">
const connections = {
  websites: [
    { name: 'phamphugia.vn', url: '#' },
    { name: 'phamphugia.com.vn', url: '#' },
    { name: 'phamphugiagroup.vn', url: '#' },
  ],
  facebook: [
    { name: 'phamphugia Official', url: '#' },
    { name: 'phamphugia Tuyển Dụng', url: '#' },
    { name: 'phamphugia Community', url: '#' },
  ],
  zalo: [
    { name: 'phamphugia CSKH', url: '#' },
    { name: 'phamphugia Kinh Doanh', url: '#' },
    { name: 'phamphugia Nội Bộ', url: '#' },
  ],
}

const contacts = [
  { dept: 'Đại diện nhà đầu tư', phone: '028 1234 5670' },
  { dept: 'Hội đồng quản trị', phone: '028 1234 5671' },
  { dept: 'Ban cố vấn', phone: '028 1234 5672' },
  { dept: 'Ban kiểm soát', phone: '028 1234 5673' },
  { dept: 'Ban giám đốc', phone: '028 1234 5674' },
  { dept: 'Phòng hành chính nhân sự', phone: '028 1234 5675' },
  { dept: 'Phòng tài chính kế toán', phone: '028 1234 5676' },
  { dept: 'Phòng kỹ thuật sản xuất', phone: '028 1234 5677' },
  { dept: 'Phòng kinh doanh công nghệ', phone: '028 1234 5678' },
  { dept: 'Phòng lưu trữ truyền thông', phone: '028 1234 5679' },
]

const bankInfo = {
  account: '1234 5678 9012 3456',
  bank: 'Vietcombank',
  taxCode: '0123456789',
}

const offices = [
  'Trụ sở công ty',
  'Chi nhánh văn phòng - Hà Nội',
  'Chi nhánh văn phòng - Hưng Yên',
  'Chi nhánh văn phòng - Đà Nẵng',
]

const totalVisitors = 125_847

/** Nhúng đơn giản (q + output=embed) — tránh chuỗi pb bị lỗi mã hóa khiến bản đồ trắng. */
const mapEmbedUrl =
  'https://maps.google.com/maps?q=10.77627%2C106.69765&hl=vi&z=15&output=embed'
</script>

<template>
  <footer class="w-full text-gray-900" style="background: #d2eadb; margin-top: 10px">
    <!-- Desktop: 3 cột ngang -->
    <div class="w-full px-10 py-10 flex gap-8 max-lg:flex-col overflow-hidden max-sm:hidden">
      <!-- Cột 1: Thông tin kết nối (1.5/5) -->
      <div class="w-[18%] shrink-0 max-lg:w-full" style="padding-left: 15px">
        <h3 class="text-gray-900 text-base font-bold uppercase mb-4 pb-2 border-b-2 border-gray-900/30">
          Thông tin kết nối
        </h3>

        <div class="mb-3">
          <ul class="pl-3">
            <li v-for="site in connections.websites" :key="site.name" style="font-size: 15px; padding: 5px 0">
              <a :href="site.url" class="text-gray-900 transition-colors hover:text-[#f0a500]">{{ site.name }}</a>
            </li>
          </ul>
        </div>

        <div class="mb-4">
          <h4 class="font-semibold text-gray-900 mb-2" style="font-size: 17px">Facebook</h4>
          <ul class="pl-3">
            <li v-for="fb in connections.facebook" :key="fb.name" style="font-size: 15px; padding: 5px 0">
              <a :href="fb.url" class="text-gray-900 transition-colors hover:text-[#f0a500]">{{ fb.name }}</a>
            </li>
          </ul>
        </div>

        <div class="mb-4">
          <h4 class="font-semibold text-gray-900 mb-2" style="font-size: 17px">Zalo</h4>
          <ul class="pl-3">
            <li v-for="z in connections.zalo" :key="z.name" style="font-size: 15px; padding: 5px 0">
              <a :href="z.url" class="text-gray-900 transition-colors hover:text-[#f0a500]">{{ z.name }}</a>
            </li>
          </ul>
        </div>

        <div class="mt-4 flex items-center gap-2">
          <span class="text-gray-900 font-semibold" style="font-size: 15px">Tổng truy cập:</span>
          <span class="text-xl font-bold text-[#f0a500]">{{ totalVisitors.toLocaleString('vi-VN') }}</span>
        </div>
      </div>

      <!-- Cột 2: Thông tin liên hệ -->
      <div class="w-[30%] shrink-0 max-lg:w-full" style="font-size: 18px; line-height: 2">
        <h3 class="text-gray-900 text-base font-bold uppercase mb-4 pb-2 border-b-2 border-gray-900/30">
          Liên hệ phòng ban
        </h3>

        <div class="grid grid-cols-2 gap-2 mb-4">
          <div v-for="c in contacts" :key="c.dept" class="px-3 py-2 bg-white/5 rounded">
            <span class="text-[13px] text-gray-900 font-medium leading-relaxed block">{{ c.dept }}</span>
            <span class="text-[13px] text-gray-600 leading-relaxed">{{ c.phone }}</span>
          </div>
        </div>

        <div class="p-3 bg-[#f0a500]/10 rounded border border-[#f0a500]/20" style="font-size: 15px; line-height: 1.6">
          <p class="text-gray-800 leading-relaxed mb-1">
            <strong class="text-gray-900">Số tài khoản:</strong> {{ bankInfo.account }} - {{ bankInfo.bank }}
          </p>
          <p class="text-gray-800 leading-relaxed">
            <strong class="text-gray-900">Mã số thuế:</strong> {{ bankInfo.taxCode }}
          </p>
        </div>
      </div>

      <!-- Cột 3: Bản đồ -->
      <div class="w-[47%] shrink-0 max-lg:w-full min-w-0 overflow-hidden">
        <h3 class="text-gray-900 text-base font-bold uppercase mb-4 pb-2 border-b-2 border-gray-900/30">
          Vị trí văn phòng
        </h3>

        <div class="grid grid-cols-2 gap-2 max-sm:grid-cols-1 w-full">
          <div v-for="office in offices" :key="office" class="bg-white/5 rounded overflow-hidden">
            <div class="px-2.5 py-1.5 border-b border-white/10">
              <h4 class="text-sm font-semibold text-gray-900 truncate">{{ office }}</h4>
            </div>
            <div class="w-full overflow-hidden" style="min-height: 190px">
              <iframe
                :src="mapEmbedUrl"
                width="100%"
                height="190"
                class="border-0"
                allowfullscreen
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile: dạng card xếp dọc kiểu tin tức -->
    <div class="hidden max-sm:block px-3 py-4">
      <!-- Card 1: Thông tin kết nối -->
      <div class="bg-white overflow-hidden" style="margin-bottom: 20px">
        <div class="bg-[#1a3a5c] px-4 py-3">
          <h3 class="text-white text-base font-bold uppercase text-center">Thông tin kết nối</h3>
        </div>
        <div class="p-4">
          <div class="flex gap-4">
            <!-- Cột trái: Website + Zalo -->
            <div class="flex-1" style="padding-left: 20px">
              <h4 class="font-semibold text-gray-900 mb-2" style="font-size: 15px">Website</h4>
              <div v-for="site in connections.websites" :key="site.name" style="padding: 4px 0">
                <a :href="site.url" class="text-[#1a3a5c]" style="font-size: 14px">{{ site.name }}</a>
              </div>
              <h4 class="font-semibold text-gray-900 mb-2" style="font-size: 15px; margin-top: 12px">Zalo</h4>
              <div v-for="z in connections.zalo" :key="z.name" style="padding: 4px 0">
                <a :href="z.url" class="text-[#1a3a5c]" style="font-size: 14px">{{ z.name }}</a>
              </div>
            </div>
            <!-- Cột phải: Facebook -->
            <div class="flex-1">
              <h4 class="font-semibold text-gray-900 mb-2" style="font-size: 15px">Facebook</h4>
              <div v-for="fb in connections.facebook" :key="fb.name" style="padding: 4px 0">
                <a :href="fb.url" class="text-[#1a3a5c]" style="font-size: 14px">{{ fb.name }}</a>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-center gap-2 pt-3 border-t border-gray-200" style="margin-top: 12px">
            <span class="text-gray-900 font-semibold" style="font-size: 14px">Tổng truy cập:</span>
            <span class="text-lg font-bold text-[#f0a500]">{{ totalVisitors.toLocaleString('vi-VN') }}</span>
          </div>
        </div>
      </div>

      <!-- Card 2: Liên hệ phòng ban -->
      <div class="bg-white overflow-hidden" style="margin-bottom: 20px">
        <div class="bg-[#2c5f8a] px-4 py-3">
          <h3 class="text-white text-base font-bold uppercase text-center">Liên hệ phòng ban</h3>
        </div>
        <div class="p-4">
          <div v-for="c in contacts" :key="c.dept" class="flex justify-between items-center border-b border-gray-100 last:border-b-0" style="padding: 6px 20px; line-height: 2">
            <span class="text-gray-900 font-medium" style="font-size: 14px">{{ c.dept }}</span>
            <a :href="'tel:' + c.phone.replace(/\s/g, '')" class="text-[#1a3a5c] font-semibold" style="font-size: 14px">{{ c.phone }}</a>
          </div>
          <div class="mt-3" style="font-size: 14px; padding: 12px 12px 12px 20px; line-height: 2">
            <p class="text-gray-800 mb-1">
              <strong>STK:</strong> {{ bankInfo.account }} - {{ bankInfo.bank }}
            </p>
            <p class="text-gray-800">
              <strong>MST:</strong> {{ bankInfo.taxCode }}
            </p>
          </div>
        </div>
      </div>

      <!-- Card 3: Vị trí văn phòng -->
      <div class="bg-white overflow-hidden" style="margin-bottom: 20px">
        <div class="bg-[#0d4a2f] px-4 py-3">
          <h3 class="text-white text-base font-bold uppercase text-center">Vị trí văn phòng</h3>
        </div>
        <div class="p-3">
          <div v-for="office in offices" :key="office" class="overflow-hidden" style="margin-bottom: 12px">
            <h4 class="font-semibold text-gray-900" style="font-size: 14px; padding: 6px 20px; line-height: 2">{{ office }}</h4>
            <iframe
              :src="mapEmbedUrl"
              width="100%"
              height="180"
              class="border-0"
              allowfullscreen
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>
