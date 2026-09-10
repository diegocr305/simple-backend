// Configuracion de desarrollo.
// El frontend solo habla con Supabase (URL + anon key, ambas publicas).
// La comunicacion con SIMPLE la manejan las Edge Functions en el servidor,
// asi que el token de SIMPLE NO debe estar aqui.
export const environment = {
  production: false,
  supabaseUrl: 'https://gyhihuovussdauehmeuk.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aGlodW92dXNzZGF1ZWhtZXVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NjA2NTksImV4cCI6MjA2ODMzNjY1OX0.d70DaieRw-zHAhug1ZmEn7aDBEH5k6uFBc2I2eOOP30',
};
