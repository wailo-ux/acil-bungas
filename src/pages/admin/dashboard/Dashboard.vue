<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import mqtt from 'mqtt'
import { mqttState } from '../../../store/mqttState'
import VueApexCharts from 'vue3-apexcharts' // Import Grafik

// 1. KEMBALIKAN VARIABEL PENTING YANG SEMPAT TERHAPUS
const client = ref(null)
const mqttConnected = ref(false)
const userRole = ref('crew')

const sensorData = ref({ rain: 0, temp: 0, hum: 0, r: 0, d: 0, main_10: false, buf_100: false, buf_90: false, mode: 'auto' })
const manualMode = ref(false)
const localRefill = ref(false)
const localDose = ref(false)

const inputRainReset = ref(10)
const inputRainDuration = ref(15)
const inputValveDelay = ref(5)
let isParamInitialized = false

const rainLogs = ref([])
const isRainLoading = ref(false)
const sortOrder = ref('desc')

let espWatchdog = null

// --- KONFIGURASI GRAFIK REAL-TIME ---
const chartSeries = ref([
  { name: 'Suhu (°C)', data: [] },
  { name: 'Kelembaban (%)', data: [] }
])

const chartOptions = ref({
  chart: { 
    type: 'line', 
    animations: { enabled: true, easing: 'linear', dynamicAnimation: { speed: 1000 } },
    toolbar: { show: false },
    zoom: { enabled: false }
  },
  stroke: { curve: 'smooth', width: 3 },
  colors: ['#f97316', '#22c55e'], // Oranye & Hijau
  xaxis: { categories: [], labels: { show: true, style: { fontSize: '9px', colors: '#94a3b8' } } },
  yaxis: [
    { title: { text: 'Suhu (°C)', style: { color: '#f97316', fontSize: '10px' } }, min: 0, max: 50 },
    { opposite: true, title: { text: 'Kelembaban (%)', style: { color: '#22c55e', fontSize: '10px' } }, min: 0, max: 100 }
  ],
  legend: { position: 'top', horizontalAlign: 'right' },
  grid: { borderColor: '#f1f5f9', strokeDashArray: 4 }
})
// ------------------------------------

const resetWatchdog = () => {
  clearTimeout(espWatchdog)
  mqttState.espOnline = true
  espWatchdog = setTimeout(() => { mqttState.espOnline = false }, 15000)
}

const sortedRainLogs = computed(() => {
  return [...rainLogs.value].sort((a, b) => sortOrder.value === 'desc' ? b.id - a.id : a.id - b.id);
})

const toggleSort = () => sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'

onMounted(() => {
  // Pengecekan role SPV tidak akan error lagi karena variabel sudah dikembalikan
  const savedUser = localStorage.getItem('user')
  if (savedUser) { userRole.value = JSON.parse(savedUser).role }
  
  mqttState.mqttOnline = false
  mqttState.espOnline = false

  connectMQTT()
  fetchRainLogs()
  setInterval(fetchRainLogs, 10000)
})

const connectMQTT = () => {
  // 2. KONEKSI MQTT WEB WAJIB MENGGUNAKAN PORT WEBSOCKET (8084)
  const url = `ws://topswspu401:8084`
  
  client.value = mqtt.connect(url, {
    clientId: 'VueDash-' + Math.random().toString(16).substring(2, 8),
    clean: true
  })

  client.value.on('connect', () => {
    mqttConnected.value = true
    mqttState.mqttOnline = true
    client.value.subscribe('pt_top/dosing/site_a/data')
    client.value.subscribe('pt_top/dosing/site_a/status')
  })

  client.value.on('close', () => {
    mqttConnected.value = false
    mqttState.mqttOnline = false
    mqttState.espOnline = false
    clearTimeout(espWatchdog)
  })

  client.value.on('message', (topic, message) => {
    if (topic === 'pt_top/dosing/site_a/status') {
      if (message.toString() === 'offline') {
        clearTimeout(espWatchdog)
        mqttState.espOnline = false
      }
    } else if (topic === 'pt_top/dosing/site_a/data') {
      try {
        resetWatchdog()
        const payload = JSON.parse(message.toString())
        sensorData.value = { ...sensorData.value, ...payload }
        localRefill.value = payload.r == 1
        localDose.value = payload.d == 1
        manualMode.value = payload.mode === 'manual'

        const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        chartOptions.value.xaxis.categories.push(timeNow)
        chartSeries.value[0].data.push(payload.temp || 0)
        chartSeries.value[1].data.push(payload.hum || 0)

        if (chartSeries.value[0].data.length > 15) {
          chartOptions.value.xaxis.categories.shift()
          chartSeries.value[0].data.shift()
          chartSeries.value[1].data.shift()
        }

        if (!isParamInitialized && payload.p_reset !== undefined) {
          inputRainReset.value = payload.p_reset
          inputRainDuration.value = payload.p_durasi
          inputValveDelay.value = payload.p_delay
          isParamInitialized = true
        }
      } catch (e) { console.error("JSON Error", e) }
    }
  })
}

const sendCommand = (payloadObj) => { if (client.value && mqttConnected.value) client.value.publish('pt_top/dosing/site_a/command', JSON.stringify(payloadObj)) }
const toggleAuto = () => sendCommand({ mode: manualMode.value ? 'manual' : 'auto' })
const controlValve = (type) => type === 'REFILL' ? sendCommand({ valve1: !localRefill.value }) : sendCommand({ valve2: !localDose.value })

const saveParameters = () => {
  if (client.value && mqttConnected.value) {
    client.value.publish('pt_top/dosing/site_a/command', JSON.stringify({ cmd: "set_param", p_reset: Number(inputRainReset.value), p_durasi: Number(inputRainDuration.value), p_delay: Number(inputValveDelay.value) }))
    alert("Berhasil! Parameter telah dikirim ke mesin.")
  }
}

const fetchRainLogs = async () => {
  isRainLoading.value = true
  try {
    const response = await fetch('topswspu401:8888/api/logs')
    rainLogs.value = await response.json()
  } catch (error) {}
  finally { isRainLoading.value = false }
}

onUnmounted(() => { if (client.value) client.value.end(); clearTimeout(espWatchdog); })
</script>
<template>
  <div class="w-full flex flex-col gap-6 animate-fade-in">
    
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
      <h1 class="font-bold text-3xl text-gray-800">WCP 4 Site Monitoring</h1>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm transition-colors border" :class="mqttState.mqttOnline ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'">
          <div class="w-2.5 h-2.5 rounded-full" :class="mqttState.mqttOnline ? 'bg-blue-500 animate-pulse' : 'bg-red-500'"></div>
          <span class="text-[10px] font-bold uppercase tracking-wider" :class="mqttState.mqttOnline ? 'text-blue-700' : 'text-red-700'">{{ mqttState.mqttOnline ? 'Server OK' : 'Server Terputus' }}</span>
        </div>
        <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm transition-colors border" :class="mqttState.espOnline ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'">
          <div class="w-2.5 h-2.5 rounded-full" :class="mqttState.espOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-400'"></div>
          <span class="text-[10px] font-bold uppercase tracking-wider" :class="mqttState.espOnline ? 'text-green-700' : 'text-slate-500'">{{ mqttState.espOnline ? 'ESP32 Aktif' : 'ESP32 Offline' }}</span>
        </div>
      </div>
    </div>
    
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all">
        <div class="p-4 rounded-xl bg-blue-50 text-blue-600"><span class="material-symbols-outlined text-3xl">water_drop</span></div>
        <div><p class="text-slate-400 text-xs font-bold uppercase tracking-wider">Curah Hujan</p><h2 class="text-2xl font-bold text-slate-800 m-0">{{ sensorData.rain }} <span class="text-lg font-medium">mm</span></h2></div>
      </div>
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all">
        <div class="p-4 rounded-xl bg-orange-50 text-orange-600"><span class="material-symbols-outlined text-3xl">thermostat</span></div>
        <div><p class="text-slate-400 text-xs font-bold uppercase tracking-wider">Suhu</p><h2 class="text-2xl font-bold text-slate-800 m-0">{{ sensorData.temp }}°C</h2></div>
      </div>
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all">
        <div class="p-4 rounded-xl bg-green-50 text-green-600"><span class="material-symbols-outlined text-3xl">cloud</span></div>
        <div><p class="text-slate-400 text-xs font-bold uppercase tracking-wider">Kelembaban</p><h2 class="text-2xl font-bold text-slate-800 m-0">{{ sensorData.hum }}%</h2></div>
      </div>
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all">
        <div class="p-4 rounded-xl" :class="sensorData.mode === 'auto' ? 'bg-indigo-50 text-indigo-600' : 'bg-yellow-50 text-yellow-600'"><span class="material-symbols-outlined text-3xl">{{ sensorData.mode === 'auto' ? 'smart_toy' : 'back_hand' }}</span></div>
        <div><p class="text-slate-400 text-xs font-bold uppercase tracking-wider">Mode</p><h2 class="text-xl font-bold text-slate-800 m-0 uppercase">{{ sensorData.mode }}</h2></div>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 w-full">
      <h3 class="font-bold text-lg text-slate-800 mb-2 flex items-center gap-2">
        <span class="material-symbols-outlined text-indigo-500">show_chart</span> Tren Suhu & Kelembaban (Live)
      </h3>
      <VueApexCharts type="line" height="280" :options="chartOptions" :series="chartSeries"></VueApexCharts>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
      <div class="p-5 rounded-2xl text-white shadow-md transition-colors" :class="sensorData.main_10 ? 'bg-emerald-500' : 'bg-red-500'">
        <h3 class="font-bold text-sm mb-1 opacity-90">Tangki Utama (1200L)</h3><p class="font-bold text-xl">{{ sensorData.main_10 ? 'STOK AMAN' : 'KRITIS / KOSONG' }}</p>
      </div>
      <div class="p-5 rounded-2xl text-white shadow-md transition-colors" :class="sensorData.buf_100 ? 'bg-amber-500' : 'bg-blue-500'">
        <h3 class="font-bold text-sm mb-1 opacity-90">Buffer Atas (100%)</h3><p class="font-bold text-xl">{{ sensorData.buf_100 ? 'LEVEL PENUH' : 'PENGISIAN...' }}</p>
      </div>
      <div class="p-5 rounded-2xl text-white shadow-md transition-colors" :class="sensorData.buf_90 ? 'bg-emerald-500' : 'bg-amber-500'">
        <h3 class="font-bold text-sm mb-1 opacity-90">Buffer Bawah (90%)</h3><p class="font-bold text-xl">{{ sensorData.buf_90 ? 'SIAP DOSING' : 'LEVEL RENDAH' }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h3 class="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><span class="material-symbols-outlined text-blue-500">settings</span> Status Aktuator</h3>
        <div class="flex flex-col gap-4">
          <div class="flex justify-between items-center p-4 rounded-xl bg-slate-50 border"><span class="font-bold text-sm">Valve Refill (V1)</span><span class="px-3 py-1 rounded-full text-xs font-bold" :class="sensorData.r ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">{{ sensorData.r ? 'TERBUKA' : 'TERTUTUP' }}</span></div>
          <div class="flex justify-between items-center p-4 rounded-xl bg-slate-50 border"><span class="font-bold text-sm">Valve Dosing (V2)</span><span class="px-3 py-1 rounded-full text-xs font-bold" :class="sensorData.d ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">{{ sensorData.d ? 'TERBUKA' : 'TERTUTUP' }}</span></div>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all" :class="!manualMode ? 'bg-slate-50/50' : ''">
        <div class="flex justify-between items-center mb-6">
          <h3 class="font-bold text-lg text-slate-800 flex items-center gap-2"><span class="material-symbols-outlined text-amber-500">tune</span> Kontrol Manual</h3>
          <label class="flex items-center cursor-pointer bg-slate-100 p-1 rounded-full border border-slate-200">
            <span class="px-3 py-1 text-xs font-bold rounded-full transition-colors" :class="!manualMode ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'">AUTO</span><input type="checkbox" v-model="manualMode" @change="toggleAuto" class="hidden" /><span class="px-3 py-1 text-xs font-bold rounded-full transition-colors" :class="manualMode ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'">MANUAL</span>
          </label>
        </div>
        <div class="flex flex-col gap-4">
          <button @click="controlValve('REFILL')" :disabled="!manualMode || sensorData.buf_100 || !sensorData.main_10" class="flex items-center justify-center gap-2 h-14 font-bold text-sm rounded-xl shadow-md transition-all disabled:opacity-50" :class="localRefill ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'"><span class="material-symbols-outlined">{{ localRefill ? 'stop_circle' : 'play_circle' }}</span> {{ localRefill ? 'STOP REFILL' : 'START REFILL' }}</button>
          <button @click="controlValve('DOSE')" :disabled="!manualMode || (!sensorData.buf_90 && !sensorData.main_10)" class="flex items-center justify-center gap-2 h-14 font-bold text-sm rounded-xl shadow-md transition-all disabled:opacity-50" :class="localDose ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'"><span class="material-symbols-outlined">{{ localDose ? 'stop_circle' : 'science' }}</span> {{ localDose ? 'STOP DOSING' : 'START DOSING' }}</button>
        </div>
      </div>

      <div v-if="userRole === 'spv'" class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h3 class="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><span class="material-symbols-outlined text-purple-500">display_settings</span> Parameter Sistem</h3>
        <div class="flex flex-col gap-4">
          <div><label class="block text-xs font-bold text-slate-500 mb-1">Reset Hujan</label><div class="relative"><input type="number" v-model="inputRainReset" class="w-full px-4 py-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-blue-500"><span class="absolute right-4 top-3 text-sm font-medium text-slate-400">menit</span></div></div>
          <div><label class="block text-xs font-bold text-slate-500 mb-1">Syarat Dosing</label><div class="relative"><input type="number" v-model="inputRainDuration" class="w-full px-4 py-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-blue-500"><span class="absolute right-4 top-3 text-sm font-medium text-slate-400">menit</span></div></div>
          <div><label class="block text-xs font-bold text-slate-500 mb-1">Delay Open/Close</label><div class="relative"><input type="number" v-model="inputValveDelay" class="w-full px-4 py-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-blue-500"><span class="absolute right-4 top-3 text-sm font-medium text-slate-400">detik</span></div></div>
          <button @click="saveParameters" :disabled="!mqttConnected" class="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all disabled:opacity-50 flex justify-center gap-2"><span class="material-symbols-outlined text-base">save</span> Simpan Parameter</button>
        </div>
      </div>
      <div v-else class="bg-blue-50 border p-8 rounded-2xl flex flex-col items-center justify-center text-center gap-4 shadow-inner">
        <div class="p-4 bg-white rounded-full"><span class="material-symbols-outlined text-blue-600 text-5xl">lock</span></div>
        <div><p class="font-bold text-blue-900">Akses Terbatas</p><p class="text-xs text-blue-700 font-medium mt-1">Pengaturan parameter sistem hanya diubah oleh Supervisor HSE.</p></div>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 w-full mt-2">
      <div class="flex justify-between items-center mb-6">
        <h3 class="font-bold text-lg text-slate-800 flex items-center gap-2"><span class="material-symbols-outlined text-blue-500">history_toggle_off</span> Riwayat Sesi Hujan</h3>
        <div class="flex items-center gap-2">
          <button @click="toggleSort" class="flex items-center gap-1 px-3 py-2 bg-slate-50 hover:bg-slate-100 border rounded-lg text-xs font-bold text-slate-600"><span class="material-symbols-outlined text-[16px]">sort</span>{{ sortOrder === 'desc' ? 'Terbaru' : 'Terlama' }}</button>
          <button @click="fetchRainLogs" class="p-2 bg-slate-50 hover:bg-slate-100 border rounded-lg flex"><span class="material-symbols-outlined text-slate-500 text-[20px]">refresh</span></button>
        </div>
      </div>
      <div class="overflow-x-auto rounded-xl border border-slate-200">
        <table class="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr class="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
              <th class="p-4 border-b">Waktu Mulai</th><th class="p-4 border-b">Waktu Selesai</th><th class="p-4 border-b text-center">Durasi Hujan</th><th class="p-4 border-b text-right">Total Curah Hujan</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr v-if="sortedRainLogs.length === 0"><td colspan="4" class="p-8 text-center text-slate-400 font-medium">Belum ada riwayat data sesi hujan.</td></tr>
            <tr v-for="log in sortedRainLogs" :key="log.id" class="border-b hover:bg-slate-50 transition-colors">
              <td class="p-4 text-slate-600">{{ log.waktu_mulai || '-' }}</td>
              <td class="p-4 text-slate-600">{{ log.waktu_selesai || '-' }}</td>
              <td class="p-4 text-center font-bold text-slate-800">{{ log.durasi_menit }} Menit</td>
              <td class="p-4 text-right"><span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{{ log.total_hujan }} mm</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>