
import {
    IsEmail,
    IsString,
    MinLength,
    MaxLength,
    IsOptional,
} from 'class-validator';

export class RegisterDto {
    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(12)
    @MaxLength(128)
    password!: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    firstName?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    lastName?: string;
}
