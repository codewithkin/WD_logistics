'use client';

import { motion } from 'framer-motion';
import { Loader2, Zap } from 'lucide-react';

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

const item = {
    hidden: { opacity: 0, y: 10 },
    show: {
        opacity: 1,
        y: 0,
        transition: { type: 'spring' as const, stiffness: 100 },
    },
};

export default function Loading() {
    return (
        <div className="min-h-screen bg-linear-to-br from-background via-background to-primary/5 flex items-center justify-center p-4 overflow-hidden">
            {/* Animated background elements */}
            <motion.div
                className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"
                animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 6, repeat: Infinity }}
            />
            <motion.div
                className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"
                animate={{ scale: [1.3, 1, 1.3], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 6, repeat: Infinity, delay: 0.5 }}
            />

            <motion.div
                className="relative z-10 max-w-md w-full"
                variants={container}
                initial="hidden"
                animate="show"
            >
                {/* Loader Icon with pulsing effect */}
                <motion.div
                    className="flex justify-center mb-8"
                    variants={item}
                >
                    <div className="relative w-32 h-32 flex items-center justify-center">
                        {/* Outer rotating ring */}
                        <motion.div
                            className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-secondary"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' as const }}
                        />

                        {/* Middle rotating ring */}
                        <motion.div
                            className="absolute inset-4 rounded-full border-2 border-transparent border-b-primary border-l-secondary"
                            animate={{ rotate: -360 }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                        />

                        {/* Inner pulsing circle */}
                        <motion.div
                            className="relative w-12 h-12 flex items-center justify-center"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <Zap className="w-8 h-8 text-primary" />
                        </motion.div>
                    </div>
                </motion.div>

                {/* Text content */}
                <div className="text-center space-y-4">
                    <motion.h1
                        className="text-3xl md:text-4xl font-bold text-foreground"
                        variants={item}
                    >
                        Loading
                    </motion.h1>

                    <motion.p
                        className="text-muted-foreground"
                        variants={item}
                    >
                        Optimizing your logistics operations...
                    </motion.p>
                </div>

                {/* Animated progress indicators */}
                <motion.div
                    className="mt-8 space-y-3"
                    variants={item}
                >
                    <div className="space-y-2">
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-linear-to-r from-primary via-secondary to-primary"
                                initial={{ width: 0 }}
                                animate={{ width: '100%' }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        </div>
                    </div>

                    {/* Status steps */}
                    <div className="grid grid-cols-3 gap-2">
                        {['Connecting', 'Syncing', 'Ready'].map((step, index) => (
                            <motion.div
                                key={step}
                                className="text-center"
                                variants={item}
                            >
                                <motion.div
                                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mx-auto mb-1"
                                    animate={{
                                        scale: [1, 1.1, 1],
                                        backgroundColor: [
                                            'var(--color-muted)',
                                            index === 0 ? 'var(--color-primary)' : 'var(--color-muted)',
                                            'var(--color-muted)',
                                        ],
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        delay: index * 0.6,
                                    }}
                                >
                                    {index === 0 && (
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                        >
                                            <Loader2 className="w-4 h-4 text-primary" />
                                        </motion.div>
                                    )}
                                </motion.div>
                                <p className="text-xs text-muted-foreground">{step}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Floating particles animation */}
                <motion.div
                    className="mt-12 flex justify-center gap-4"
                    variants={item}
                >
                    {[...Array(5)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="w-1 h-1 bg-primary rounded-full"
                            animate={{
                                y: [0, -15, 0],
                                opacity: [0.3, 1, 0.3],
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                delay: i * 0.15,
                            }}
                        />
                    ))}
                </motion.div>
            </motion.div>
        </div>
    );
}
