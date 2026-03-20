'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Search, Check, X, Calendar, AlertTriangle, Plus, Copy, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { generateCertificateHTML } from '@/lib/certificates/generateCertificate';

interface Certificate {
  id: string;
  code: string;
  certificate_type: 'money' | 'product';
  amount?: number;
  product_id?: string;
  product_name?: string;
  format: 'electronic' | 'printed';
  recipient_name?: string;
  recipient_email?: string;
  valid_from: string;
  valid_until: string;
  redeemed: boolean;
  redeemed_at?: string;
  redeemed_order_id?: string;
  order_id?: string;
  purchaser_name?: string;
  purchaser_email?: string;
  message?: string;
  created_at: string;
}

export default function CertificatesAdminPage() {
  const supabase = createClient();

  // State
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [filteredCertificates, setFilteredCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'redeemed' | 'expired'>('all');
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendMonths, setExtendMonths] = useState(1);

  // Fetch certificates
  const fetchCertificates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCertificates(data);
      setFilteredCertificates(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  // Filter certificates
  useEffect(() => {
    let filtered = certificates;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (cert) =>
          cert.code.toLowerCase().includes(query) ||
          cert.recipient_name?.toLowerCase().includes(query) ||
          cert.recipient_email?.toLowerCase().includes(query) ||
          cert.product_name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      const now = new Date();
      filtered = filtered.filter((cert) => {
        if (filterStatus === 'redeemed') return cert.redeemed;
        if (filterStatus === 'expired') return !cert.redeemed && new Date(cert.valid_until) < now;
        if (filterStatus === 'active') return !cert.redeemed && new Date(cert.valid_until) >= now;
        return true;
      });
    }

    setFilteredCertificates(filtered);
  }, [searchQuery, filterStatus, certificates]);

  // Calculate stats
  const stats = {
    total: certificates.length,
    active: certificates.filter(
      (c) => !c.redeemed && new Date(c.valid_until) >= new Date()
    ).length,
    redeemed: certificates.filter((c) => c.redeemed).length,
    expired: certificates.filter(
      (c) => !c.redeemed && new Date(c.valid_until) < new Date()
    ).length,
  };

  // Mark as redeemed manually
  const handleMarkAsRedeemed = async (certificate: Certificate) => {
    if (!confirm(`Позначити сертифікат ${certificate.code} як використаний?`)) return;

    const { error } = await supabase
      .from('certificates')
      .update({
        redeemed: true,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', certificate.id);

    if (error) {
      toast.error('Помилка оновлення сертифікату');
    } else {
      toast.success('Сертифікат позначено як використаний');
      fetchCertificates();
    }
  };

  // Extend validity
  const handleExtendValidity = async () => {
    if (!selectedCertificate) return;

    const currentValidUntil = new Date(selectedCertificate.valid_until);
    currentValidUntil.setMonth(currentValidUntil.getMonth() + extendMonths);

    const { error } = await supabase
      .from('certificates')
      .update({
        valid_until: currentValidUntil.toISOString(),
      })
      .eq('id', selectedCertificate.id);

    if (error) {
      toast.error('Помилка продовження терміну дії');
    } else {
      toast.success(`Термін дії продовжено на ${extendMonths} міс.`);
      setShowExtendModal(false);
      setExtendMonths(1);
      fetchCertificates();
    }
  };

  // Copy certificate code
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Код скопійовано');
  };

  // View certificate HTML
  const handleViewCertificate = (certificate: Certificate) => {
    const html = generateCertificateHTML(certificate);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a8a]"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-900 mb-2">Подарункові сертифікати</h1>
        <p className="text-stone-600">Управління виданими сертифікатами</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-stone-200">
          <div className="text-sm text-stone-500 mb-1">Всього</div>
          <div className="text-3xl font-bold text-stone-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-green-200">
          <div className="text-sm text-green-600 mb-1">Активні</div>
          <div className="text-3xl font-bold text-green-600">{stats.active}</div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-blue-200">
          <div className="text-sm text-blue-600 mb-1">Використані</div>
          <div className="text-3xl font-bold text-blue-600">{stats.redeemed}</div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-red-200">
          <div className="text-sm text-red-600 mb-1">Прострочені</div>
          <div className="text-3xl font-bold text-red-600">{stats.expired}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 border border-stone-200 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              type="text"
              placeholder="Пошук за кодом, отримувачем, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filterStatus === 'all'
                  ? 'bg-[#1e3a8a] text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Всі
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filterStatus === 'active'
                  ? 'bg-green-600 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Активні
            </button>
            <button
              onClick={() => setFilterStatus('redeemed')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filterStatus === 'redeemed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Використані
            </button>
            <button
              onClick={() => setFilterStatus('expired')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filterStatus === 'expired'
                  ? 'bg-red-600 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Прострочені
            </button>
          </div>
        </div>
      </div>

      {/* Certificates Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {filteredCertificates.length === 0 ? (
          <div className="p-12 text-center">
            <Gift className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-500">Сертифікатів не знайдено</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Код</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Тип</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Значення</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Отримувач</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Формат</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Дійсний до</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Статус</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredCertificates.map((cert) => {
                  const isExpired = !cert.redeemed && new Date(cert.valid_until) < new Date();
                  const isActive = !cert.redeemed && new Date(cert.valid_until) >= new Date();

                  return (
                    <tr key={cert.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-bold text-[#1e3a8a]">{cert.code}</code>
                          <button
                            onClick={() => handleCopyCode(cert.code)}
                            className="p-1 hover:bg-stone-200 rounded transition-colors"
                          >
                            <Copy className="w-4 h-4 text-stone-400" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-stone-600">
                          {cert.certificate_type === 'money' ? '💵 Грошовий' : '🎁 Продукт'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {cert.certificate_type === 'money' ? (
                          <span className="font-semibold text-stone-900">{cert.amount} ₴</span>
                        ) : (
                          <span className="text-sm text-stone-600">{cert.product_name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-stone-900">{cert.recipient_name || '—'}</div>
                          <div className="text-stone-500">{cert.recipient_email || '—'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-stone-600">
                          {cert.format === 'electronic' ? '📧 Email' : '📦 Друк'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-stone-600">
                          {new Date(cert.valid_until).toLocaleDateString('uk-UA')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {cert.redeemed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                            <Check className="w-3 h-3" />
                            Використано
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            Прострочений
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                            <Check className="w-3 h-3" />
                            Активний
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedCertificate(cert);
                              setShowDetailsModal(true);
                            }}
                            className="p-2 hover:bg-stone-200 rounded transition-colors"
                            title="Деталі"
                          >
                            <ExternalLink className="w-4 h-4 text-stone-600" />
                          </button>
                          <button
                            onClick={() => handleViewCertificate(cert)}
                            className="p-2 hover:bg-stone-200 rounded transition-colors"
                            title="Переглянути сертифікат"
                          >
                            <Gift className="w-4 h-4 text-stone-600" />
                          </button>
                          {isActive && !cert.redeemed && (
                            <>
                              <button
                                onClick={() => handleMarkAsRedeemed(cert)}
                                className="p-2 hover:bg-blue-100 rounded transition-colors"
                                title="Позначити використаним"
                              >
                                <Check className="w-4 h-4 text-blue-600" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedCertificate(cert);
                                  setShowExtendModal(true);
                                }}
                                className="p-2 hover:bg-green-100 rounded transition-colors"
                                title="Продовжити термін"
                              >
                                <Calendar className="w-4 h-4 text-green-600" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedCertificate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-stone-900">Деталі сертифікату</h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm text-stone-500">Код</div>
                  <div className="font-mono font-bold text-2xl text-[#1e3a8a]">{selectedCertificate.code}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-stone-500">Тип</div>
                    <div className="font-medium">
                      {selectedCertificate.certificate_type === 'money' ? 'Грошовий' : 'На продукт'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-stone-500">Формат</div>
                    <div className="font-medium">
                      {selectedCertificate.format === 'electronic' ? 'Електронний' : 'Друкований'}
                    </div>
                  </div>
                </div>

                {selectedCertificate.certificate_type === 'money' && (
                  <div>
                    <div className="text-sm text-stone-500">Сума</div>
                    <div className="font-bold text-xl">{selectedCertificate.amount} ₴</div>
                  </div>
                )}

                {selectedCertificate.certificate_type === 'product' && (
                  <div>
                    <div className="text-sm text-stone-500">Продукт</div>
                    <div className="font-medium">{selectedCertificate.product_name}</div>
                  </div>
                )}

                <div>
                  <div className="text-sm text-stone-500">Отримувач</div>
                  <div className="font-medium">{selectedCertificate.recipient_name || '—'}</div>
                  <div className="text-sm text-stone-600">{selectedCertificate.recipient_email || '—'}</div>
                </div>

                {selectedCertificate.message && (
                  <div>
                    <div className="text-sm text-stone-500">Повідомлення</div>
                    <div className="bg-stone-50 p-4 rounded-lg italic text-stone-700">
                      {selectedCertificate.message}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-stone-500">Дата видачі</div>
                    <div className="font-medium">
                      {new Date(selectedCertificate.created_at).toLocaleDateString('uk-UA')}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-stone-500">Дійсний до</div>
                    <div className="font-medium">
                      {new Date(selectedCertificate.valid_until).toLocaleDateString('uk-UA')}
                    </div>
                  </div>
                </div>

                {selectedCertificate.purchaser_name && (
                  <div>
                    <div className="text-sm text-stone-500">Покупець</div>
                    <div className="font-medium">{selectedCertificate.purchaser_name}</div>
                    <div className="text-sm text-stone-600">{selectedCertificate.purchaser_email}</div>
                  </div>
                )}

                {selectedCertificate.redeemed && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="font-medium text-blue-900 mb-1">Використано</div>
                    <div className="text-sm text-blue-700">
                      {new Date(selectedCertificate.redeemed_at!).toLocaleDateString('uk-UA')}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extend Validity Modal */}
      <AnimatePresence>
        {showExtendModal && selectedCertificate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowExtendModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-stone-900 mb-6">Продовжити термін дії</h2>

              <div className="mb-6">
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Продовжити на (місяців)
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={extendMonths}
                  onChange={(e) => setExtendMonths(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                />
              </div>

              <div className="bg-stone-50 p-4 rounded-lg mb-6">
                <div className="text-sm text-stone-600 mb-1">Поточний термін:</div>
                <div className="font-medium text-stone-900">
                  {new Date(selectedCertificate.valid_until).toLocaleDateString('uk-UA')}
                </div>
                <div className="text-sm text-stone-600 mt-2 mb-1">Новий термін:</div>
                <div className="font-bold text-green-600">
                  {new Date(
                    new Date(selectedCertificate.valid_until).setMonth(
                      new Date(selectedCertificate.valid_until).getMonth() + extendMonths
                    )
                  ).toLocaleDateString('uk-UA')}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowExtendModal(false)}
                  className="flex-1 px-4 py-2 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleExtendValidity}
                  className="flex-1 px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-[#1e40af] transition-colors"
                >
                  Продовжити
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
