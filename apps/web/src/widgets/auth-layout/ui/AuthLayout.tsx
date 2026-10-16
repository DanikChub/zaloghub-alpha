
import type { ReactNode } from 'react'
import { Card, Flex, Typography } from 'antd'

interface AuthLayoutProps {
    title: string
    description?: string
    children: ReactNode
}

export function AuthLayout({
                               title,
                               description,
                               children,
                           }: AuthLayoutProps) {
    return (
        <Flex
            align="center"
            justify="center"
            style={{
                minHeight: '100vh',
                padding: 24,
                background: '#f5f7fb',
            }}
        >
            <Card
                style={{
                    width: '100%',
                    maxWidth: 440,
                }}
            >
                <Flex vertical gap={24}>
                    <div>
                        <Typography.Title level={3} style={{ marginBottom: 8 }}>
                            {title}
                        </Typography.Title>

                        {description && (
                            <Typography.Text type="secondary">
                                {description}
                            </Typography.Text>
                        )}
                    </div>

                    {children}
                </Flex>
            </Card>
        </Flex>
    )
}
