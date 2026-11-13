
import { IsEmail, IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class LoginDto {
    @IsOptional()
    @IsString()
    @MaxLength(4096)
    trustedDeviceToken?: string;

    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    password!: string;
}
