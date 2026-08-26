import pool from './connection.js';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { runMigrations } from './migration-runner.js';
import { isValidPassword, PASSWORD_RULE_MESSAGE } from '../utils/validators.js';

async function initDB() {
  let connection;
  try {
    console.log(`[BOOT] 🔌 Tentando conectar ao banco em: ${env.DB.HOST}...`);
    connection = await pool.getConnection();
    console.log('[BOOT] ✅ Conexão estabelecida.');

    if (env.AUTO_RUN_MIGRATIONS) {
      console.log('[BOOT] AUTO_RUN_MIGRATIONS=true; executando migrations pendentes...');
      await runMigrations();
    } else {
      console.log('[BOOT] AUTO_RUN_MIGRATIONS=false; execute npm run db:migrate antes do start em producao.');
    }

    if (env.ENABLE_DEV_BOOTSTRAP) {
      const [devs]: any = await connection.query('SELECT id FROM usuarios WHERE desenvolvedor = 1 LIMIT 1');
      if (devs.length === 0) {
        if (!env.DEV_EMAIL || !env.DEV_PASSWORD) {
          throw new Error('[BOOT] ENABLE_DEV_BOOTSTRAP=true exige DEV_EMAIL e DEV_PASSWORD.');
        }
        if (!isValidPassword(env.DEV_PASSWORD) || env.DEV_PASSWORD.length < 12) {
          throw new Error(`[BOOT] DEV_PASSWORD invalida para seed do desenvolvedor. ${PASSWORD_RULE_MESSAGE} Use pelo menos 12 caracteres no bootstrap.`);
        }

        console.log('[BOOT] 🌱 Semeando usuário desenvolvedor inicial...');
        const hashedPassword = await bcrypt.hash(env.DEV_PASSWORD, 12);

        await connection.query(
          'INSERT INTO usuarios (nome, email, senha_hash, cargo, administrador, desenvolvedor) VALUES (?, ?, ?, ?, ?, ?)',
          ['Desenvolvedor Master', env.DEV_EMAIL, hashedPassword, 'System Developer', 1, 1]
        );
        console.log(`[BOOT] ✅ Desenvolvedor inicial criado: ${env.DEV_EMAIL}. Desative ENABLE_DEV_BOOTSTRAP após o primeiro acesso.`);
      }
    }

    console.log('[BOOT] ✨ Inicialização do banco concluída com sucesso.');
  } catch (error) {
    console.error('[BOOT] ❌ Erro ao inicializar banco de dados:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

export { initDB };
