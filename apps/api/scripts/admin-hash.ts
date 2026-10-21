// 관리자 비밀번호를 bcrypt 해시로 바꿔 `.env`에 붙여 넣을 한 줄을 출력한다.
// 비밀번호를 명령 인자로 받지 않는다. 셸 기록에 남기 때문이다. 입력하는 글자는 화면에 보이지 않는다.
import bcrypt from 'bcryptjs';

function readHidden(prompt: string): Promise<string> {
  const { stdin, stdout } = process;
  stdout.write(prompt);
  return new Promise((resolve) => {
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    // 붙여 넣기처럼 여러 글자가 한 번에 들어올 수 있어 한 글자씩 본다.
    const onData = (chunk: string) => {
      for (const key of chunk) {
        if (key === '\u0003') process.exit(130); // Ctrl+C
        if (key === '\r' || key === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          return resolve(value);
        }
        if (key === '\u007f')
          value = value.slice(0, -1); // Backspace
        else value += key;
      }
    };
    stdin.on('data', onData);
  });
}

// 입력을 받을 수 없는 환경(파이프, 에디터의 명령 실행 창 등)에서는 비밀번호를 가려서 받을 수 없다.
if (!process.stdin.isTTY) {
  console.error(
    '비밀번호를 입력받을 수 없는 환경입니다. 터미널 앱을 열어 저장소 폴더에서 `pnpm admin:hash`를 실행하세요.',
  );
  process.exit(1);
}

const password = await readHidden('관리자 비밀번호: ');
const again = await readHidden('한 번 더: ');
if (!password || password !== again) {
  console.error('두 비밀번호가 비어 있거나 서로 다릅니다.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
// 해시에 들어 있는 `$`가 변수로 해석되지 않도록 작은따옴표로 감싼다.
console.log(
  `\n.env에 아래 한 줄을 붙여 넣으세요.\n\nADMIN_PASSWORD_HASH='${hash}'\n`,
);
