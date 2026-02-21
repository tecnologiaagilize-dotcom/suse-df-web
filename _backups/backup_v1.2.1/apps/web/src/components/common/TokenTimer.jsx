import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function TokenTimer({ expiresAt, onExpire }) {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!expiresAt) return;

        const calculateTimeLeft = () => {
            const difference = new Date(expiresAt) - new Date();
            
            if (difference <= 0) {
                setTimeLeft('00:00');
                if (onExpire) onExpire();
                return false;
            }

            const minutes = Math.floor((difference / 1000 / 60) % 60);
            const seconds = Math.floor((difference / 1000) % 60);

            const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            setTimeLeft(formatted);
            return true;
        };

        calculateTimeLeft();
        const timer = setInterval(() => {
            if (!calculateTimeLeft()) {
                clearInterval(timer);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [expiresAt, onExpire]);

    return (
        <div className="flex flex-col items-center justify-center mt-2 bg-red-50 border border-red-100 rounded-lg p-2 animate-pulse">
            <div className="flex items-center gap-2 text-red-600 font-bold text-lg">
                <Clock size={20} />
                <span>{timeLeft}</span>
            </div>
            <p className="text-[10px] text-red-400 uppercase font-bold tracking-wider">Tempo restante do token</p>
        </div>
    );
}
