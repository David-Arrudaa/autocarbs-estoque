/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Módulo: Scanner de Código de Barras & Câmera Cross-Device
 * =========================================================
 */

const ScannerModule = {
    scannerAtivo: false,
    scannerStream: null,
    scannerAnimFrame: null,
    scannerHtml5QrCode: null,
    scannerCameraFacing: 'environment', // Traseira por padrão
    scannerTorchLigada: false,
    scannerAudioCtx: null,
    scannerContexto: 'busca', // 'busca' ou 'cadastro'

    /**
     * Inicializa eventos e listeners físicos
     */
    init() {
        this.iniciarLeitorTecladoUSB();
    },

    /**
     * Emite um beep sonoro clássico de PDV (1800Hz) via Web Audio API
     */
    tocarBeepScanner() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            if (!this.scannerAudioCtx) {
                this.scannerAudioCtx = new AudioContext();
            }
            if (this.scannerAudioCtx.state === 'suspended') {
                this.scannerAudioCtx.resume();
            }
            const osc = this.scannerAudioCtx.createOscillator();
            const gain = this.scannerAudioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1800, this.scannerAudioCtx.currentTime);
            gain.gain.setValueAtTime(0.18, this.scannerAudioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.scannerAudioCtx.currentTime + 0.09);
            osc.connect(gain);
            gain.connect(this.scannerAudioCtx.destination);
            osc.start();
            osc.stop(this.scannerAudioCtx.currentTime + 0.09);
        } catch (_) {}
    },

    /**
     * Intercepta leitores físicos de código de barras USB/Bluetooth
     */
    iniciarLeitorTecladoUSB() {
        let buffer = '';
        let lastKeyTime = 0;

        window.addEventListener('keydown', (e) => {
            const now = Date.now();
            const diff = now - lastKeyTime;
            lastKeyTime = now;

            const target = e.target;
            const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

            // Leitores físicos de código de barras digitam em alta velocidade (< 85ms entre teclas)
            if (diff > 85 && buffer.length > 0) {
                buffer = '';
            }

            if (e.key === 'Enter') {
                if (buffer.length >= 3) {
                    const codigoDetectado = buffer.trim();
                    buffer = '';

                    // Se o usuário estiver focado no input de código do cadastro de peça
                    if (isInput && target.id === 'codigo') {
                        this.tocarBeepScanner();
                        UI.toast('Código registrado via Leitor USB!', 'success');
                        return;
                    }

                    e.preventDefault();
                    this.tocarBeepScanner();
                    this.processarCodigoEscaneado(codigoDetectado);
                }
                buffer = '';
            } else if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                buffer += e.key;
            }
        });
    },

    /**
     * Abre o modal do scanner por câmera
     * @param {'busca'|'cadastro'} contexto
     */
    async abrirScanner(contexto = 'busca') {
        this.scannerContexto = contexto;
        this.scannerAtivo = true;

        const manualInput = document.getElementById('scanner-manual-code');
        if (manualInput) manualInput.value = '';

        const modalTitulo = document.getElementById('scanner-modal-titulo');
        const modalSub = document.getElementById('scanner-modal-subtitle');
        if (modalTitulo && modalSub) {
            if (contexto === 'cadastro') {
                modalTitulo.innerText = 'ESCANEAR PARA CADASTRO';
                modalSub.innerText = 'Aponte a câmera para o código de barras da nova peça';
            } else {
                modalTitulo.innerText = 'LEITOR DE CÓDIGO DE BARRAS';
                modalSub.innerText = 'Aponte a câmera para consultar ou dar movimentação rápida';
            }
        }

        const statusText = document.getElementById('scanner-status-text');
        if (statusText) statusText.innerText = 'Inicializando câmera...';

        UI.abrirModal('modal-barcode-scanner');
        await this.iniciarCameraScanner();
    },

    /**
     * Inicializa stream de vídeo com BarcodeDetector nativo ou Html5Qrcode fallback
     */
    async iniciarCameraScanner() {
        const video = document.getElementById('scanner-video');
        const html5Container = document.getElementById('scanner-html5-view');
        const statusText = document.getElementById('scanner-status-text');

        this.fecharCameraScanner();
        this.scannerAtivo = true;

        // Prioridade 1: BarcodeDetector nativo (Chrome / Edge / Android)
        const temBarcodeDetector = ('BarcodeDetector' in window);

        if (temBarcodeDetector && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                if (html5Container) html5Container.style.display = 'none';
                if (video) video.style.display = 'block';

                const constraints = {
                    video: {
                        facingMode: { ideal: this.scannerCameraFacing },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                this.scannerStream = stream;

                if (video) {
                    video.srcObject = stream;
                    await video.play();
                }

                // Detecta capacidade de lanterna
                const track = stream.getVideoTracks()[0];
                const capabilities = (track && track.getCapabilities) ? track.getCapabilities() : {};
                const btnTorch = document.getElementById('btn-scanner-toggle-torch');
                if (btnTorch) {
                    if (capabilities.torch) {
                        btnTorch.classList.remove('hidden');
                    } else {
                        btnTorch.classList.add('hidden');
                    }
                }

                if (statusText) statusText.innerText = 'Posicione o código no quadro';

                const formats = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'itf'];
                const detector = new window.BarcodeDetector({ formats });

                const scanLoop = async () => {
                    if (!this.scannerAtivo) return;

                    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
                        try {
                            const barcodes = await detector.detect(video);
                            if (barcodes && barcodes.length > 0) {
                                const rawValue = barcodes[0].rawValue;
                                if (rawValue && rawValue.trim()) {
                                    this.tocarBeepScanner();
                                    this.fecharScanner();
                                    this.processarCodigoEscaneado(rawValue.trim());
                                    return;
                                }
                            }
                        } catch (_) {}
                    }
                    this.scannerAnimFrame = requestAnimationFrame(scanLoop);
                };

                this.scannerAnimFrame = requestAnimationFrame(scanLoop);
                return;
            } catch (err) {
                console.warn('Fallback para Html5Qrcode:', err);
            }
        }

        // Prioridade 2: Html5Qrcode (Fallback universal ZXing)
        if (window.Html5Qrcode && html5Container) {
            try {
                if (video) video.style.display = 'none';
                html5Container.style.display = 'block';
                html5Container.innerHTML = '';

                const html5QrCode = new Html5Qrcode('scanner-html5-view');
                this.scannerHtml5QrCode = html5QrCode;

                const config = {
                    fps: 15,
                    qrbox: { width: 250, height: 140 },
                    aspectRatio: 1.777778
                };

                await html5QrCode.start(
                    { facingMode: this.scannerCameraFacing },
                    config,
                    (decodedText) => {
                        if (decodedText && decodedText.trim() && this.scannerAtivo) {
                            this.tocarBeepScanner();
                            this.fecharScanner();
                            this.processarCodigoEscaneado(decodedText.trim());
                        }
                    },
                    () => {}
                );

                if (statusText) statusText.innerText = 'Posicione o código no quadro';
                return;
            } catch (err) {
                console.warn('Falha no Html5Qrcode:', err);
            }
        }

        if (statusText) statusText.innerText = 'Câmera não detectada. Digite abaixo:';
        const manualInput = document.getElementById('scanner-manual-code');
        if (manualInput) {
            setTimeout(() => manualInput.focus(), 150);
        }
    },

    /**
     * Encerra streams da câmera
     */
    fecharCameraScanner() {
        this.scannerAtivo = false;

        if (this.scannerAnimFrame) {
            cancelAnimationFrame(this.scannerAnimFrame);
            this.scannerAnimFrame = null;
        }

        if (this.scannerStream) {
            this.scannerStream.getTracks().forEach(track => {
                try { track.stop(); } catch (_) {}
            });
            this.scannerStream = null;
        }

        const video = document.getElementById('scanner-video');
        if (video) {
            video.srcObject = null;
        }

        if (this.scannerHtml5QrCode) {
            try {
                this.scannerHtml5QrCode.stop().catch(() => {}).then(() => {
                    try { this.scannerHtml5QrCode.clear(); } catch (_) {}
                    this.scannerHtml5QrCode = null;
                });
            } catch (_) {
                this.scannerHtml5QrCode = null;
            }
        }

        const html5Container = document.getElementById('scanner-html5-view');
        if (html5Container) {
            html5Container.innerHTML = '';
            html5Container.style.display = 'none';
        }

        this.scannerTorchLigada = false;
        const labelTorch = document.getElementById('label-scanner-torch');
        if (labelTorch) labelTorch.innerText = 'Lanterna';
    },

    fecharScanner() {
        this.fecharCameraScanner();
        UI.fecharModal('modal-barcode-scanner');
    },

    async alternarCameraScanner() {
        this.scannerCameraFacing = (this.scannerCameraFacing === 'environment') ? 'user' : 'environment';
        await this.iniciarCameraScanner();
    },

    async alternarLanternaScanner() {
        if (!this.scannerStream) return;
        const track = this.scannerStream.getVideoTracks()[0];
        if (!track || !track.applyConstraints) return;

        try {
            this.scannerTorchLigada = !this.scannerTorchLigada;
            await track.applyConstraints({
                advanced: [{ torch: this.scannerTorchLigada }]
            });
            const labelTorch = document.getElementById('label-scanner-torch');
            if (labelTorch) {
                labelTorch.innerText = this.scannerTorchLigada ? 'Desligar Lanterna' : 'Ligar Lanterna';
            }
        } catch (err) {
            console.warn('Erro ao alternar lanterna:', err);
        }
    },

    confirmarCodigoManual() {
        const input = document.getElementById('scanner-manual-code');
        const codigo = input ? input.value.trim() : '';
        if (!codigo) {
            return UI.toast('Por favor, digite um código de barras ou referência.', 'warning');
        }
        this.tocarBeepScanner();
        this.fecharScanner();
        this.processarCodigoEscaneado(codigo);
    },

    /**
     * Processa o código lido (seja via USB, Câmera ou Manual)
     */
    processarCodigoEscaneado(codigo) {
        if (this.scannerContexto === 'cadastro') {
            const inputCod = document.getElementById('codigo');
            if (inputCod) {
                inputCod.value = codigo;
                inputCod.focus();
                UI.toast(`Código "${codigo}" preenchido no cadastro!`, 'success');
            }
            return;
        }

        if (window.Estoque && Estoque.processarCodigoEscaneado) {
            Estoque.processarCodigoEscaneado(codigo);
        }
    }
};

window.ScannerModule = ScannerModule;

// Pontes de retrocompatibilidade com chamadas legado do Estoque
if (window.Estoque) {
    Estoque.abrirScannerCodigoBarras = (ctx) => ScannerModule.abrirScanner(ctx);
    Estoque.fecharScanner = () => ScannerModule.fecharScanner();
    Estoque.iniciarCameraScanner = () => ScannerModule.iniciarCameraScanner();
    Estoque.fecharCameraScanner = () => ScannerModule.fecharCameraScanner();
    Estoque.alternarCameraScanner = () => ScannerModule.alternarCameraScanner();
    Estoque.alternarLanternaScanner = () => ScannerModule.alternarLanternaScanner();
    Estoque.confirmarCodigoManual = () => ScannerModule.confirmarCodigoManual();
    Estoque.tocarBeepScanner = () => ScannerModule.tocarBeepScanner();
}

document.addEventListener('DOMContentLoaded', () => {
    ScannerModule.init();
});

