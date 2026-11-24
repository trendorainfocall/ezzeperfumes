// .env həmişə server qovluğundan oxunur (əmr hansı qovluqdan işlədilsə də: kökdən, client-dən, server-dən)
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });
