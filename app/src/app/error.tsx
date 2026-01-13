'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.2,
            delayChildren: 0.1,
        },
    },
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: {
        opacity: 1,
        y: 0,
        transition: { type: 'spring' as const, stiffness: 100 },
    },
};

const shake = {
    x: [0, -10, 10, -10, 10, 0],
    transition: {
        duration: 0.5,
        repeat: Infinity,
        repeatDelay: 2,
    },
};

interface ErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-screen bg-linear-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4 overflow-hidden">
            {/* Animated background elements */}
            <motion.div
                className="absolute top-20 left-10 w-72 h-72 bg-destructive/10 rounded-full blur-3xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 8, repeat: Infinity }}
            />
            <motion.div
                className="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
                animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 8, repeat: Infinity, delay: 1 }}
            />

            <motion.div
                className="relative z-10 max-w-2xl w-full"
                variants={container}
                initial="hidden"
                animate="show"
            >
                {/* Error Icon */}
                <motion.div
                    className="flex justify-center mb-8"
                    variants={item}
                    animate={shake}
                >
                    <div className="relative">
                        <motion.div
                            className="absolute inset-0 bg-destructive/20 rounded-full blur-xl"
                            animate={{ scale: [1, 1.3, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                        <AlertTriangle className="w-24 h-24 text-destructive relative z-10" strokeWidth={1.5} />
                    </div>
                </motion.div>

                {/* Main Content */}
                <div className="text-center space-y-4">
                    {/* Error Code */}
                    <motion.h1
                        className="text-6xl md:text-7xl font-bold bg-linear-to-r from-destructive via-primary to-destructive bg-clip-text text-transparent"
                        variants={item}
                    >
                        Oops!
                    </motion.h1>

                    {/* Heading */}
                    <motion.h2
                        className="text-3xl md:text-4xl font-bold text-foreground"
                        variants={item}
                    >
                        Something Went Wrong
                    </motion.h2>

                    {/* Description */}
                    <motion.p
                        className="text-lg text-muted-foreground max-w-md mx-auto"
                        variants={item}
                    >
                        We encountered an unexpected error in the system. Our team has been notified and is working on a fix.
                    </motion.p>

                    {/* Error Details */}
                    {error.message && (
                        <motion.div
                            className="bg-muted/50 border border-destructive/20 rounded-lg p-4 max-w-md mx-auto text-left"
                            variants={item}
                        >
                            <p className="text-sm font-mono text-muted-foreground wrap-break-word">
                                {error.message}
                            </p>
                            {error.digest && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Error ID: {error.digest}
                                </p>
                            )}
                        </motion.div>
                    )}
                </div>

                {/* Action Buttons */}
                <motion.div
                    className="flex flex-col sm:flex-row gap-4 justify-center mt-12"
                    variants={item}
                >
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Button
                            onClick={reset}
                            className="gap-2 px-8 py-6 text-base w-full sm:w-auto"
                            size="lg"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Try Again
                        </Button>
                    </motion.div>

                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Link href="/" className="w-full">
                            <Button
                                variant="outline"
                                className="gap-2 px-8 py-6 text-base w-full"
                                size="lg"
                            >
                                <Home className="w-5 h-5" />
                                Go Home
                            </Button>
                        </Link>
                    </motion.div>
                </motion.div>

                {/* Status indicator */}
                <motion.div
                    className="mt-12 flex flex-col items-center gap-2"
                    variants={item}
                >
                    <div className="flex gap-2">
                        {[...Array(4)].map((_, i) => (
                            <motion.div
                                key={i}
                                className="w-2 h-2 bg-destructive rounded-full"
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    delay: i * 0.1,
                                }}
                            />
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Error being investigated</p>
                </motion.div>
            </motion.div>
        </div>
    );
}
