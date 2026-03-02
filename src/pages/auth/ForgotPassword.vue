<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const step = ref(1) // 1: Verify, 2: Reset
const form = ref({ username: '', answer: '', new_password: '' })
const showPassword = ref(false)
const errorMsg = ref('')
const isLoading = ref(false)

const handleVerify = async () => {
  if (!form.value.username || !form.value.answer) {
    errorMsg.value = "Username dan Jawaban wajib diisi!"
    return
  }
  
  isLoading.value = true
  errorMsg.value = ''
  
  try {
    const res = await fetch('http://10.210.69.112:3000/api/auth/verify-security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.value.username, answer: form.value.answer })
    })
    const data = await res.json()
    if (res.ok && data.status === 'success') {
      step.value = 2
    } else {
      errorMsg.value = data.message || 'Verifikasi Gagal'
    }
  } catch(e) {
    errorMsg.value = 'Koneksi server gagal'
  } finally {
    isLoading.value = false
  }
}

const handleReset = async () => {
  if (!form.value.new_password) {
    errorMsg.value = "Password baru wajib diisi!"
    return
  }

  isLoading.value = true
  errorMsg.value = ''

  try {
    const res = await fetch('http://10.210.69.112:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.value.username, new_password: form.value.new_password })
    })
    const data = await res.json()
    if (res.ok && data.status === 'success') {
      alert('Password berhasil diganti! Silakan login.')
      router.push({ name: 'login' })
    } else {
      errorMsg.value = data.message || 'Gagal mereset password'
    }
  } catch(e) {
    errorMsg.value = 'Koneksi server gagal'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="mb-4">
      <h1 class="font-bold text-3xl text-gray-800 mb-2">Reset Password</h1>
      <p class="text-sm text-gray-500">
        Ingat password Anda? 
        <router-link :to="{ name: 'login' }" class="font-bold text-blue-600 hover:underline">
          Log in disini
        </router-link>
      </p>
    </div>

    <div v-if="errorMsg" class="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
      {{ errorMsg }}
    </div>

    <form v-if="step === 1" @submit.prevent="handleVerify" class="flex flex-col gap-4">
      <p class="text-sm text-gray-600 mb-2">Masukkan username dan jawaban keamanan untuk memverifikasi identitas Anda.</p>
      
      <div class="flex flex-col gap-1">
        <label class="text-sm font-semibold text-gray-700">Username</label>
        <input v-model="form.username" type="text" placeholder="Masukkan username" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-semibold text-gray-700">Jawaban Keamanan</label>
        <input v-model="form.answer" type="text" placeholder="Masukkan jawaban" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <button type="submit" :disabled="isLoading" class="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-50">
        {{ isLoading ? 'Memproses...' : 'Lanjutkan' }}
      </button>
    </form>

    <form v-else @submit.prevent="handleReset" class="flex flex-col gap-4">
      <div class="bg-green-50 text-green-700 text-sm p-3 rounded-lg border border-green-200 mb-2">
        Identitas terverifikasi! Silakan buat password baru Anda.
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-semibold text-gray-700">Password Baru</label>
        <div class="relative w-full">
          <input v-model="form.new_password" :type="showPassword ? 'text' : 'password'" placeholder="Masukkan password baru" class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-3.5 text-sm font-bold text-gray-400 hover:text-gray-600">
            {{ showPassword ? 'SEMBUNYIKAN' : 'LIHAT' }}
          </button>
        </div>
      </div>

      <button type="submit" :disabled="isLoading" class="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-50">
        {{ isLoading ? 'Menyimpan...' : 'Simpan Password Baru' }}
      </button>
    </form>
  </div>
</template>


