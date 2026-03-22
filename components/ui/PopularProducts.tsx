'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Product {
  id: string
  name: string
  slug: string
  price: number
  sale_price: number | null
  price_from: boolean
  images: string[]
}

export default function PopularProducts() {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('products')
      .select('id, name, slug, price, sale_price, price_from, images')
      .eq('is_popular', true)
      .eq('is_active', true)
      .eq('status', 'active')
      .order('popular_order', { ascending: true, nullsFirst: false })
      .limit(4)
      .then(({ data }) => {
        if (data) setProducts(data)
      })
  }, [])

  if (products.length === 0) return null

  return (
    <section className="py-16 bg-[#f8f9ff]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-[#1a1a2e] mb-3">
            Популярні продукти
          </h2>
          <p className="text-gray-500 text-base max-w-xl mx-auto">
            Найбільш замовлювані вироби нашої майстерні
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/catalog/${product.slug}`}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className="aspect-square bg-gray-100 overflow-hidden">
                {product.images?.[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#e8ebf8] to-[#f0f2ff]">
                    <span className="text-4xl">📸</span>
                  </div>
                )}
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-sm text-[#1a1a2e] leading-tight mb-2 line-clamp-2">
                  {product.name}
                </h3>
                <p className="text-[#1e2d7d] font-bold text-sm">
                  {product.price_from ? 'від ' : ''}
                  {product.sale_price
                    ? product.sale_price.toLocaleString('uk-UA')
                    : product.price.toLocaleString('uk-UA')}{' '}
                  ₴
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 text-[#1e2d7d] font-semibold hover:underline text-sm"
          >
            Переглянути всі продукти →
          </Link>
        </div>
      </div>
    </section>
  )
}
