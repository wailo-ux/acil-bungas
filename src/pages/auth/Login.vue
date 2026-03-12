<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const keepLoggedIn = ref(false)
const errorMessage = ref('')
const isLoading = ref(false)

const handleLogin = async () => {
  if (!username.value || !password.value) {
    errorMessage.value = "Username dan Password wajib diisi!"
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  
  try {
    const response = await fetch('topswspu401:8888/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value,
        password: password.value
      })
    })

    const result = await response.json()

    if (response.ok && result.status === 'success') {
      localStorage.setItem('user', JSON.stringify(result.data))
      router.push({ name: 'dashboard' })
    } else {
      errorMessage.value = result.message || 'Login Gagal'
    }
  } catch (err) {
    errorMessage.value = 'Tidak dapat terhubung ke server API'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <form @submit.prevent="handleLogin" class="flex flex-col gap-4">
    <div class="mb-4">
      <h1 class="font-bold text-3xl text-gray-800 mb-2">Log in</h1>
      <p class="text-sm text-gray-500">
        Belum punya akun? 
        <router-link :to="{ name: 'register' }" class="font-bold text-blue-600 hover:underline">
          Daftar disini
        </router-link>
      </p>
    </div>

    <div v-if="errorMessage" class="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
      {{ errorMessage }}
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-sm font-semibold text-gray-700">Username</label>
      <input 
        v-model="username" 
        type="text" 
        placeholder="Masukkan username"
        class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-sm font-semibold text-gray-700">Password</label>
      <div class="relative w-full">
        <input 
          v-model="password" 
          :type="showPassword ? 'text' : 'password'" 
          placeholder="Masukkan password"
          class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button 
          type="button" 
          @click="showPassword = !showPassword" 
          class="absolute right-3 top-3.5 text-sm font-bold text-gray-400 hover:text-gray-600"
        >
          {{ showPassword ? 'SEMBUNYIKAN' : 'LIHAT' }}
        </button>
      </div>
    </div>

    <div class="flex justify-between items-center mt-2">
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" v-model="keepLoggedIn" class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        <span class="text-sm text-gray-600">Ingat Saya</span>
      </label>
      <router-link :to="{ name: 'forgot-password' }" class="text-sm font-semibold text-blue-600 hover:underline">
        Lupa Password?
      </router-link>
    </div>

    <button 
      type="submit" 
      :disabled="isLoading"
      class="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-50"
    >
      {{ isLoading ? 'Memproses...' : 'Login' }}
    </button>
  </form>
</template>