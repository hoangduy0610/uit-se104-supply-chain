import { JwtService } from '@nestjs/jwt';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UserService } from './UserService';
import { AuthDto, SetNewPasswordDto, ValidateOtpDto } from 'src/dtos/AuthDto';
import { ApplicationException } from 'src/controllers/ExceptionController';
import { AccountService } from './AccountService';
import { UserModal } from 'src/modals/UserModals';
import { UserRepository } from 'src/repositories/UserRepository';
import { MessageCode } from 'src/commons/MessageCode';
import { StringUtils } from 'src/utils/StringUtils';
import { Constant } from 'src/commons/Constant';

const bcrypt = require('bcrypt');

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Use `true` for port 465, `false` for all other ports
    auth: {
        user: "hoangduy06104@gmail.com",
        pass: "ffgjiykuyumfvyqg",
    },
});

@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UserService,
        private readonly jwtService: JwtService,
        private readonly accountService: AccountService,
        private readonly userRepository: UserRepository,
    ) {
    }

    async register(userAuthDto: AuthDto): Promise<any> {
        try {
            Logger.log('[START] - Register with user: ' + StringUtils.xssPrevent(userAuthDto.username), null, false);

            const user = await this.userRepository.findAuthInfo(StringUtils.xssPrevent(userAuthDto.username));

            if (user) {
                throw new ApplicationException(HttpStatus.UNAUTHORIZED, MessageCode.USER_ALREADY_EXISTED);
            }
            return await this.accountService.register(StringUtils.xssPrevent(userAuthDto.username), StringUtils.xssPrevent(userAuthDto.password));

        } catch (e) {
            throw new ApplicationException(HttpStatus.BAD_REQUEST, MessageCode.USER_CREATE_ERROR)
        }
    }


    async login(userAuthDto: AuthDto): Promise<any> {
        try {
            Logger.log('[START] - Login with user: ' + StringUtils.xssPrevent(userAuthDto.username), null, false);

            const user = await this.userRepository.findOneByUsername(StringUtils.xssPrevent(userAuthDto.username));
            Logger.log(user);
            if (!user) {
                throw new ApplicationException(HttpStatus.NOT_FOUND, MessageCode.USER_NOT_REGISTER);
            }
            const dt = new UserModal(user);
            // if (!user.active) {
            // 	throw new ApplicationException(HttpStatus.UNAUTHORIZED, "Người dùng chưa được kích hoạt hoặc đang bị" +
            // 		" khóa ");
            // }
            const userData: any = await this.accountService.auth(StringUtils.xssPrevent(userAuthDto.username), StringUtils.xssPrevent(userAuthDto.password));
            const userPayload: any = { ...dt, username: StringUtils.xssPrevent(userAuthDto.username) };
            const JWT = this.jwtService.sign(userPayload);
            return { token: JWT, info: dt };
        } catch (e) {
            throw new ApplicationException(HttpStatus.UNAUTHORIZED, MessageCode.USER_PASSWORD_WRONG)
        }
    }

    async forgotPassword(username: string): Promise<any> {
        try {
            const user = await this.userRepository.findOneByUsername(StringUtils.xssPrevent(username));
            if (!user) {
                throw new ApplicationException(HttpStatus.NOT_FOUND, MessageCode.USER_NOT_REGISTER);
            }
            // generate new password
            const gen_OTP = StringUtils.randomGeneratePassword(6);
            user.otp = gen_OTP;
            user.otpValid = new Date(new Date().getTime() + 15 * 60000);
            await user.save();
            // Send email to user
            await transporter.sendMail({
                from: '"SmartChain" <hoangduy06104@gmail.com>', // sender address
                to: user.email, // list of receivers
                subject: "Mã OTP để đặt lại mật khẩu cho SmartChain", // Subject line
                text: `Mã OTP có hiệu lực trong 15 phút. Mã của bạn là: ${gen_OTP}`, // plain text body
                html: `Mã OTP có hiệu lực trong 15 phút. Mã của bạn là: ${gen_OTP}`, // html body
            });
            return { message: 'Reset success' }
        } catch (e) {
            if (e instanceof ApplicationException) {
                throw e;
            }
            throw new ApplicationException(HttpStatus.BAD_REQUEST, MessageCode.UNKNOWN_ERROR)
        }
    }

    async validateOtp(dto: ValidateOtpDto): Promise<any> {
        try {
            const user = await this.userRepository.findOneByUsername(dto.username);

            if (!user) {
                throw new ApplicationException(HttpStatus.NOT_FOUND, MessageCode.USER_NOT_REGISTER);
            }

            if (user.otp !== dto.otp) {
                throw new ApplicationException(HttpStatus.BAD_REQUEST, MessageCode.USER_OTP_ERROR);
            }

            if (user.otpValid < new Date()) {
                throw new ApplicationException(HttpStatus.BAD_REQUEST, MessageCode.USER_OTP_EXPIRED);
            }

            const token = await StringUtils.randomGeneratePassword(20);
            user.resetPasswordToken = token;
            user.otp = '';
            await user.save();

            return {
                message: 'OTP is valid',
                token: token
            }
        } catch (e) {
            Logger.log(e);
            if (e instanceof ApplicationException) {
                throw e;
            }
            throw new ApplicationException(HttpStatus.BAD_REQUEST, MessageCode.UNKNOWN_ERROR)
        }
    }

    async setNewPassword(dto: SetNewPasswordDto): Promise<any> {
        try {
            const user = await this.userRepository.findOneByUsername(dto.username);

            if (!user) {
                throw new ApplicationException(HttpStatus.NOT_FOUND, MessageCode.USER_NOT_REGISTER);
            }

            if (user.resetPasswordToken !== dto.token) {
                throw new ApplicationException(HttpStatus.BAD_REQUEST, MessageCode.USER_INVALID_TOKEN);
            }

            const auth = await this.userRepository.findAuthInfo(dto.username);
            const hash = await bcrypt.hashSync(dto.password, Constant.BCRYPT_ROUND);
            auth.password = hash;
            user.resetPasswordToken = '';
            await auth.save();
            await user.save();

            return { message: 'Password has been reset' }
        } catch (e) {
            Logger.log(e);
            if (e instanceof ApplicationException) {
                throw e;
            }
            throw new ApplicationException(HttpStatus.BAD_REQUEST, MessageCode.UNKNOWN_ERROR)
        }
    }

    async validateUser(payload: any): Promise<UserModal> {
        return await this.userService.findOneByUsername(payload.username);
    }
}
