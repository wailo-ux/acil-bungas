<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const form = ref({ username: '', password: '', full_name: '', question: 'Apa nama Site tempat Anda bekerja?', answer: '' })
const showPassword = ref(false)
const errorMsg = ref('')
const isLoading = ref(false)

const handleRegister = async () => {
  if (!form.value.username || !form.value.password || !form.value.full_name || !form.value.answer) {
    errorMsg.value = "Semua field wajib diisi!"
    return
  }

  isLoading.value = true
  errorMsg.value = ''

  try {
    const res = await fetch('http://10.210.69.112:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    const data = await res.json()
    if (res.ok && data.status === 'success') {
      alert('Registrasi Berhasil! Silakan Login.')
      router.push({ name: 'login' })
    } else {
      errorMsg.value = data.message || 'Registrasi Gagal'
    }
  } catch (e) { 
    errorMsg.value = 'Koneksi server gagal' 
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <form @submit.prevent="handleRegister" class="flex flex-col gap-4">
    <div class="mb-4">
      <h1 class="font-bold text-3xl text-gray-800 mb-2">Daftar Akun</h1>
      <p class="text-sm text-gray-500">
        Sudah punya akun? 
        <router-link :to="{ name: 'login' }" class="font-bold text-blue-600 hover:underline">
          Log in disini
        </router-link>
      </p>
    </div>

    <div v-if="errorMsg" class="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
      {{ errorMsg }}
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-sm font-semibold text-gray-700">Nama Lengkap</label>
      <input v-model="form.full_name" type="text" placeholder="Masukkan nama lengkap" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-sm font-semibold text-gray-700">Username</label>
      <input v-model="form.username" type="text" placeholder="Buat username" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-sm font-semibold text-gray-700">Password</label>
      <div class="relative w-full">
        <input v-model="form.password" :type="showPassword ? 'text' : 'password'" placeholder="Buat password" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-3.5 text-sm font-bold text-gray-400 hover:text-gray-600">
          {{ showPassword ? 'SEMBUNYIKAN' : 'LIHAT' }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-1 mt-2">
      <label class="text-sm font-semibold text-gray-700">Pertanyaan Keamanan</label>
      <select v-model="form.question" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm text-gray-700 cursor-pointer">
        <option>Apa nama Site tempat Anda bekerja?</option>
        <option>Apa nama Departemen Anda?</option>
        <option>Siapa nama Manager HSE Anda?</option>
      </select>
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-sm font-semibold text-gray-700">Jawaban Keamanan</label>
      <input v-model="form.answer" type="text" placeholder="Masukkan jawaban" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>

    <button type="submit" :disabled="isLoading" class="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-50">
      {{ isLoading ? 'Memproses...' : 'Daftar' }}
    </button>
  </form>
</template>