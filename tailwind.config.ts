import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: ['class'],
    content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			surface: 'hsl(var(--surface))',
  			card: 'hsl(var(--card))',
  			border: 'hsl(var(--border))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				hover: 'hsl(var(--primary) / 0.85)',
  				subtle: 'hsl(var(--primary) / 0.08)',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			success: 'hsl(var(--success))',
  			danger: 'hsl(var(--danger))',
  			warning: 'hsl(var(--warning))',
  			text: {
  				DEFAULT: 'hsl(var(--text))',
  				muted: 'hsl(var(--text-muted))',
  				secondary: 'hsl(var(--text-secondary))'
  			},
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--danger))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--surface))',
  				foreground: 'hsl(var(--text))'
  			},
  			foreground: 'hsl(var(--text))'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'var(--radius)',
  			sm: '0px',
  			DEFAULT: 'var(--radius)',
  		},
  		fontFamily: {
  			sans: ['Outfit', 'system-ui', 'sans-serif'],
  			mono: ['DM Mono', 'ui-monospace', 'monospace'],
  			display: ['Outfit', 'system-ui', 'sans-serif'],
  		},
  		animation: {
  			'pulse-dot': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  			'spin-slow': 'spin 1s linear infinite',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0', opacity: '0' },
  				to: { height: 'var(--radix-accordion-content-height)', opacity: '1' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)', opacity: '1' },
  				to: { height: '0', opacity: '0' }
  			}
  		}
  	}
  },
  plugins: [],
}

export default config
