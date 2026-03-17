import { useState } from 'react'
import { supabase } from './lib/supabase'
import { Lock, Mail, Loader2, ShieldCheck, Activity } from 'lucide-react'

export function Auth() {
    const [loading, setLoading] = useState(false)
    const [isLogin, setIsLogin] = useState(true)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccessMsg(null)

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) throw error
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: window.location.origin
                    }
                })
                if (error) throw error
                setSuccessMsg('Cadastro realizado com sucesso! Você já pode fazer login.')
                setIsLogin(true) // Switch back to login view after successful signup
            }
        } catch (err: any) {
            if (err.message === 'Invalid login credentials') {
                setError('E-mail ou senha incorretos.')
            } else if (err.message === 'User already registered') {
                setError('Este e-mail já está cadastrado.')
            } else {
                setError(err.message || 'Ocorreu um erro durante a autenticação.')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob animation-delay-2000"></div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="flex justify-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-xl flex items-center justify-center transform rotate-3 hover:rotate-6 transition-transform">
                        <Activity className="w-10 h-10 text-white" />
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
                    Smart AIH
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600 font-medium">
                    Sistema Inteligente de Faturamento SUS e SAE
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="bg-white/80 backdrop-blur-xl py-8 px-4 shadow-2xl sm:rounded-3xl sm:px-10 border border-white/50">

                    <div className="text-center mb-8">
                        <h3 className="text-xl font-bold text-gray-800">
                            {isLogin ? 'Acesse sua conta' : 'Crie sua conta'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            {isLogin ? 'Bem-vindo de volta ao futuro da auditoria.' : 'Junte-se à nova era da inteligência clínica.'}
                        </p>
                    </div>

                    <form className="space-y-6" onSubmit={handleAuth}>

                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <ShieldCheck className="h-5 w-5 text-red-500" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-red-700 font-medium">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {successMsg && (
                            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-md">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <ShieldCheck className="h-5 w-5 text-emerald-500" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-emerald-700 font-medium">{successMsg}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-gray-700">E-mail Profissional</label>
                            <div className="mt-2 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50/50 transition-colors"
                                    placeholder="enfermeiro@hospital.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700">Senha Segura</label>
                            <div className="mt-2 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50/50 transition-colors"
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg transform active:scale-[0.98]"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Entrar no Sistema' : 'Cadastrar Conta')}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsLogin(!isLogin)
                                    setError(null)
                                    setSuccessMsg(null)
                                }}
                                className="text-sm font-semibold text-blue-600 hover:text-blue-500 transition-colors"
                            >
                                {isLogin ? 'Ainda não tem conta? Cadastre-se gratuitamente' : 'Já possui conta? Faça login aqui'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center flex items-center justify-center gap-2 text-xs text-gray-400 font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Ambiente Totalmente Seguro e Criptografado</span>
                </div>
            </div>
        </div>
    )
}
