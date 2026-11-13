
export interface RegisterRequest {
    email: string
    password: string
    firstName?: string
    lastName?: string
}

export interface LoginRequest {
    trustedDeviceToken?: string
    email: string
    password: string
}

export interface AuthChallenge {
    challengeId: string
    expiresIn: number
}

export interface VerifyCodeRequest {
    challengeId: string
    code: string
}

export interface AuthTokens {
    trustedDeviceToken?: string
    accessToken: string
    tokenType: 'Bearer'
    expiresIn: number
}

export interface AuthState {
    accessToken: string | null
    challenge: AuthChallenge | null
}
