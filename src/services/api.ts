import axios from 'axios';
import Config from 'react-native-config';
import { useUserStore } from '../store/userStore';

const api = axios.create({
  baseURL: Config.BACKEND_URL || 'http://localhost:3000',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  const token = useUserStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      useUserStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

export async function loginWithWallet(
  wallet: string,
  signature: string,
  challenge: string,
) {
  const res = await api.post('/auth/login', { wallet, signature, challenge });
  return res.data;
}

export async function fetchTasks(params?: Record<string, any>) {
  const res = await api.get('/tasks', { params });
  return res.data;
}

export async function fetchTaskById(id: string) {
  const res = await api.get(`/tasks/${id}`);
  return res.data;
}

export async function submitProof(formData: FormData) {
  const res = await api.post('/proofs', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export default api;
