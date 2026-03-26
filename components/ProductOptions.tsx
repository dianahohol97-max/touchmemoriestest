'use client';

import { useState, useEffect } from 'react';
import styles from './ProductOptions.module.css';

export interface ProductAttribute {
  key: string;
  label: string;
  type: 'select' | 'color' | 'boolean' | 'number' | 'text';
  options?: string[];
  required?: boolean;
  defaultValue?: any;
}

export interface ProductOptionsProps {
  attributes: ProductAttribute[];
  onOptionsChange?: (options: Record<string, any>) => void;
  initialValues?: Record<string, any>;
}

const COLOR_MAP: Record<string, string> = {
  'чорний': '#000000',
  'білий': '#FFFFFF',
  'червоний': '#DC2626',
  'синій': '#2563EB',
  'зелений': '#16A34A',
  'жовтий': '#EAB308',
  'помаранчевий': '#EA580C',
  'фіолетовий': '#9333EA',
  'рожевий': '#EC4899',
  'сірий': '#6B7280',
  'коричневий': '#92400E',
  'бежевий': '#D4B896',
  'бордовий': '#7F1D1D',
  'темно-синій': '#1E3A8A',
  'темно-зелений': '#14532D',
  'бірюзовий': '#0891B2',
  'лавандовий': '#A78BFA',
  'персиковий': '#FDBA74',
  'мятний': '#6EE7B7',
  'золотий': '#FDE047',
  'срібний': '#D1D5DB',
};

export default function ProductOptions({
  attributes,
  onOptionsChange,
  initialValues = {}
}: ProductOptionsProps) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    attributes.forEach(attr => {
      if (initialValues[attr.key] !== undefined) {
        initial[attr.key] = initialValues[attr.key];
      } else if (attr.defaultValue !== undefined) {
        initial[attr.key] = attr.defaultValue;
      } else if (attr.type === 'select' && attr.options && attr.options.length > 0) {
        initial[attr.key] = attr.options[0];
      } else if (attr.type === 'color' && attr.options && attr.options.length > 0) {
        initial[attr.key] = attr.options[0];
      } else if (attr.type === 'boolean') {
        initial[attr.key] = false;
      }
    });
    return initial;
  });

  useEffect(() => {
    onOptionsChange?.(selectedOptions);
  }, [selectedOptions, onOptionsChange]);

  const handleOptionChange = (key: string, value: any) => {
    setSelectedOptions(prev => ({ ...prev, [key]: value }));
  };

  const isColorOption = (optionValue: string): boolean => {
    const lowerValue = optionValue.toLowerCase();
    return COLOR_MAP.hasOwnProperty(lowerValue);
  };

  const getColorCode = (optionValue: string): string => {
    return COLOR_MAP[optionValue.toLowerCase()] || '#CCCCCC';
  };

  const renderAttribute = (attr: ProductAttribute) => {
    switch (attr.type) {
      case 'select':
        // Check if all options are colors
        const allColors = attr.options?.every(opt => isColorOption(opt));

        if (allColors && attr.options) {
          // Render as color swatches
          return (
            <div className={styles.colorSwatches}>
              {attr.options.map((option) => {
                const isSelected = selectedOptions[attr.key] === option;
                const colorCode = getColorCode(option);
                const isDark = colorCode === '#000000';

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleOptionChange(attr.key, option)}
                    className={`${styles.colorSwatch} ${isSelected ? styles.selected : ''}`}
                    title={option}
                    aria-label={option}
                  >
                    <div
                      className={styles.colorCircle}
                      style={{
                        backgroundColor: colorCode,
                        border: colorCode === '#FFFFFF' || !isSelected ? '2px solid #e2e8f0' : 'none'
                      }}
                    >
                      {isSelected && (
                        <svg
                          className={styles.checkIcon}
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          style={{ color: isDark || colorCode === '#000000' ? 'white' : 'black' }}
                        >
                          <path
                            d="M13.3333 4L6 11.3333L2.66667 8"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <span className={styles.colorLabel}>{option}</span>
                  </button>
                );
              })}
            </div>
          );
        } else {
          // Render as dropdown
          return (
            <select
              value={selectedOptions[attr.key] || ''}
              onChange={(e) => handleOptionChange(attr.key, e.target.value)}
              className={styles.select}
              required={attr.required}
            >
              {attr.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          );
        }

      case 'color':
        // Direct color type (options are color names)
        return (
          <div className={styles.colorSwatches}>
            {attr.options?.map((option) => {
              const isSelected = selectedOptions[attr.key] === option;
              const colorCode = getColorCode(option);
              const isDark = colorCode === '#000000';

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleOptionChange(attr.key, option)}
                  className={`${styles.colorSwatch} ${isSelected ? styles.selected : ''}`}
                  title={option}
                  aria-label={option}
                >
                  <div
                    className={styles.colorCircle}
                    style={{
                      backgroundColor: colorCode,
                      border: colorCode === '#FFFFFF' || !isSelected ? '2px solid #e2e8f0' : 'none'
                    }}
                  >
                    {isSelected && (
                      <svg
                        className={styles.checkIcon}
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        style={{ color: isDark || colorCode === '#000000' ? 'white' : 'black' }}
                      >
                        <path
                          d="M13.3333 4L6 11.3333L2.66667 8"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span className={styles.colorLabel}>{option}</span>
                </button>
              );
            })}
          </div>
        );

      case 'boolean':
        return (
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={selectedOptions[attr.key] || false}
              onChange={(e) => handleOptionChange(attr.key, e.target.checked)}
              className={styles.checkbox}
            />
            <span>Так</span>
          </label>
        );

      case 'number':
        return (
          <input
            type="number"
            value={selectedOptions[attr.key] || ''}
            onChange={(e) => handleOptionChange(attr.key, Number(e.target.value))}
            className={styles.numberInput}
            required={attr.required}
          />
        );

      case 'text':
        return (
          <input
            type="text"
            value={selectedOptions[attr.key] || ''}
            onChange={(e) => handleOptionChange(attr.key, e.target.value)}
            className={styles.textInput}
            required={attr.required}
          />
        );

      default:
        return null;
    }
  };

  if (!attributes || attributes.length === 0) {
    return null;
  }

  return (
    <div className={styles.productOptions}>
      <h4 className={styles.heading}>Оберіть параметри:</h4>
      <div className={styles.optionsContainer}>
        {attributes.map((attr) => (
          <div key={attr.key} className={styles.optionGroup}>
            <label className={styles.label}>
              {attr.label}
              {attr.required && <span className={styles.required}>*</span>}
            </label>
            {renderAttribute(attr)}
          </div>
        ))}
      </div>
    </div>
  );
}
