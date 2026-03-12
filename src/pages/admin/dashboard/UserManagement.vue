<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const users = ref([])
const isLoading = ref(false)

onMounted(() => {
  // Proteksi Lapis 2: Tendang jika bukan SPV
  const savedUser = localStorage.getItem('user')
  if (savedUser) {
    const user = JSON.parse(savedUser)
    if (user.role !== 'spv') {
      alert('Akses Ditolak!')
      router.push({ name: 'dashboard' })
    } else {
      fetchUsers()
    }
  }
})

const fetchUsers = async () => {
  isLoading.value = true
  try {
    const response = await fetch('topswspu401:8888/api/users')
    users.value = await response.json()
  } catch (error) {
    console.error("Gagal mengambil data user")
  } finally {
    isLoading.value = false
  }
}

const approveUser = async (id) => {
  if(confirm('Setujui akun ini untuk mengakses sistem?')) {
    await fetch('topswspu401:8888/api/users/approve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id })
    })
    fetchUsers()
  }
}

const deleteUser = async (id) => {
  if(confirm('Yakin ingin menghapus akun ini secara permanen?')) {
    await fetch('topswspu401:8888/api/users/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id })
    })
    fetchUsers()
  }
}

const resetPassword = async (id, name) => {
  if(confirm(`Reset password untuk ${name} menjadi "top12345"?`)) {
    const res = await fetch('topswspu401:8888/api/users/reset', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id })
    })
    const data = await res.json()
    if(data.status === 'success') {
      alert(`Password berhasil direset!\n\nPassword baru untuk ${name} adalah: ${data.message}`)
    }
  }
}
</script>

<template>
  <div class="w-full flex flex-col gap-6 animate-fade-in">
    <div class="flex justify-between items-center w-full">
      <h1 class="font-bold text-3xl text-gray-800">Manajemen Akun Crew</h1>
      <button @click="fetchUsers" class="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-center shadow-sm">
        <span class="material-symbols-outlined text-slate-500">refresh</span>
      </button>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 w-full">
      <p class="text-sm text-slate-500 mb-6">Kelola persetujuan akses dan reset sandi untuk akun Crew Lapangan.</p>
      
      <div class="overflow-x-auto rounded-xl border border-slate-200">
        <table class="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr class="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
              <th class="p-4 border-b">Nama Lengkap</th>
              <th class="p-4 border-b">Username</th>
              <th class="p-4 border-b">Status Akses</th>
              <th class="p-4 border-b text-right">Tindakan (Action)</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr v-if="isLoading">
              <td colspan="4" class="p-8 text-center text-slate-400 font-medium">Memuat data...</td>
            </tr>
            <tr v-else-if="users.length === 0">
              <td colspan="4" class="p-8 text-center text-slate-400 font-medium">Belum ada akun Crew yang terdaftar.</td>
            </tr>
            <tr v-for="user in users" :key="user.id" class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
              <td class="p-4 font-bold text-slate-800">{{ user.full_name }}</td>
              <td class="p-4 text-slate-500">@{{ user.username }}</td>
              <td class="p-4">
                <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" 
                      :class="user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'">
                  {{ user.status === 'active' ? 'AKTIF' : 'PENDING' }}
                </span>
              </td>
              <td class="p-4 flex justify-end gap-2">
                <button v-if="user.status === 'pending'" @click="approveUser(user.id)" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors">
                  TERIMA (ACC)
                </button>
                
                <button @click="resetPassword(user.id, user.full_name)" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors">
                  RESET SANDI
                </button>
                <button @click="deleteUser(user.id)" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg text-xs font-bold transition-colors">
                  HAPUS
                </button>
              </td>
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