'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

const float = {
    y: [0, -20, 0],
    transition: {
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut' as const,
    },
};

export default function NotFound() {
    return (
        <div className="min-h-screen bg-linear-to-br from-background via-background to-secondary/5 flex items-center justify-center p-4 overflow-hidden">
            {/* Animated background elements */}
            <motion.div
                className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 8, repeat: Infinity }}
            />
            <motion.div
                className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"
                animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
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
                    animate={float}
                >
                    <div className="relative">
                        <motion.div
                            className="absolute inset-0 bg-primary/20 rounded-full blur-xl"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                        <AlertCircle className="w-24 h-24 text-primary relative z-10" strokeWidth={1.5} />
                    </div>
                </motion.div>

                {/* Main Content */}
                <div className="text-center space-y-4">
                    {/* 404 Text with number animation */}
                    <motion.div variants={item} className="space-y-2">
                        <div className="flex justify-center gap-2">
                            <motion.span
                                className="text-8xl md:text-9xl font-bold bg-linear-to-r from-primary via-secondary to-primary bg-clip-text text-transparent"
                                initial={{ scale: 0, rotate: -10 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring' as const, stiffness: 100, delay: 0.2 }}
                            >
                                4
                            </motion.span>
                            <motion.div
                                className="relative"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'linear' as const }}
                            >
                                <span className="text-8xl md:text-9xl font-bold bg-linear-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
                                    0
                                </span>
                            </motion.div>
                            <motion.span
                                className="text-8xl md:text-9xl font-bold bg-linear-to-r from-primary via-secondary to-primary bg-clip-text text-transparent"
                                initial={{ scale: 0, rotate: 10 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring' as const, stiffness: 100, delay: 0.4 }}
                            >
                                4
                            </motion.span>
                        </div>
                    </motion.div>

                    {/* Heading */}
                    <motion.h1
                        className="text-4xl md:text-5xl font-bold text-foreground"
                        variants={item}
                    >
                        Page Not Found
                    </motion.h1>

                    {/* Description */}
                    <motion.p
                        className="text-lg text-muted-foreground max-w-md mx-auto"
                        variants={item}
                    >
                        The logistics route you're looking for doesn't exist in our system. Let's navigate you back to where you need to be.
                    </motion.p>
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
                        <Link href="/">
                            <Button className="gap-2 px-8 py-6 text-base" size="lg">
                                <Home className="w-5 h-5" />
                                Back to Dashboard
                            </Button>
                        </Link>
                    </motion.div>

                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Link href="/dashboard">
                            <Button variant="outline" className="gap-2 px-8 py-6 text-base" size="lg">
                                Explore App
                                <ArrowRight className="w-5 h-5" />
                            </Button>
                        </Link>
                    </motion.div>
                </motion.div>

                {/* Decorative element */}
                <motion.div
                    className="mt-12 flex justify-center gap-2"
                    variants={item}
                >
                    {[...Array(3)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="w-2 h-2 bg-primary rounded-full"
                            animate={{ y: [0, -10, 0] }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                delay: i * 0.2,
                            }}
                        />
                    ))}
                </motion.div>
            </motion.div>
        </div>
    );
}
