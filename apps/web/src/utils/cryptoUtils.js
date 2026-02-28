
/**
 * Utilitários de Criptografia para Assinatura de Evidências
 */

/**
 * Calcula o hash SHA-256 de um Blob ou Arquivo
 * @param {Blob|File} blob - O arquivo para calcular o hash
 * @returns {Promise<string>} - O hash em formato Hexadecimal
 */
export async function computeSHA256(blob) {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}
