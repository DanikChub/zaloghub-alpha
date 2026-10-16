
import {
    IsString,
    IsUUID,
    Matches,
} from 'class-validator';

export class VerifyCodeDto {
    @IsUUID()
    challengeId!: string;

    @IsString()
    @Matches(/^\d{6}$/)
    code!: string;
}
