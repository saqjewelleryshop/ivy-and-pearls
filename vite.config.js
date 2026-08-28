import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({

  plugins:[
    react()
  ],

  server:{
    proxy:{

      /*
       * Send /media/... requests from Vite
       * to the Node/Express backend.
       *
       * IMPORTANT:
       * Change 3000 below if your backend
       * runs on a different port.
       */
      '/media':{
        target:'http://localhost:3000',
        changeOrigin:true
      }

    }
  },

  build:{

    target:'es2022',

    cssCodeSplit:true,

    sourcemap:false,

    rollupOptions:{

      output:{

        manualChunks(id){

          if(id.includes('gsap')){
            return 'motion';
          }

          if(id.includes('@stripe')){
            return 'payments';
          }

          if(id.includes('@supabase')){
            return 'supabase';
          }

          if(id.includes('node_modules')){
            return 'vendor';
          }

        }

      }

    }

  },

  ssr:{
    noExternal:[
      'react-helmet-async'
    ]
  }

});