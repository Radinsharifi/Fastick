import axios from 'axios'
export const api=axios.create({baseURL:'/api'})
api.interceptors.request.use(c=>{const t=localStorage.getItem('token');if(t)c.headers.Authorization=`Bearer ${t}`;return c})
api.interceptors.response.use(r=>r,e=>{if(e.response?.status===401){localStorage.removeItem('token');localStorage.removeItem('user');if(location.pathname!='/login')location.href='/login'}return Promise.reject(e)})
export function getError(e:any){return e?.response?.data?.detail||e?.message||'خطای غیرمنتظره'}
