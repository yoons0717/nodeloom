// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JsonField, KeyValueInput } from './draft-fields';

afterEach(cleanup);

// 스토어 대신 값을 들고 있다가, 버튼으로 밖에서 값을 바꾼다(Undo 흉내).
function Harness({
  kind,
  initial,
  outside,
  onChange,
}: {
  kind: 'json' | 'keyValue';
  initial: unknown;
  outside: unknown;
  onChange: (v: unknown) => void;
}) {
  const [value, setValue] = useState(initial);
  const change = (v: unknown) => {
    onChange(v);
    setValue(v);
  };
  return (
    <>
      {kind === 'json' ? (
        <JsonField label="테스트 입력" value={value} onChange={change} />
      ) : (
        <KeyValueInput
          label="쿼리"
          control={{ id: 'query' }}
          value={value}
          onChange={change}
        />
      )}
      <button onClick={() => setValue(outside)}>바깥에서 바꾸기</button>
    </>
  );
}

describe('JsonField', () => {
  it('깨진 JSON은 저장하지 않고 오류를 보여 주며, 고치면 저장한다', () => {
    const onChange = vi.fn();
    render(
      <Harness kind="json" initial={{}} outside={{}} onChange={onChange} />,
    );
    const input = screen.getByLabelText('테스트 입력');

    fireEvent.change(input, { target: { value: '{ "city": ' } });
    expect(screen.getByText('JSON 형식이 아닙니다')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '{ "city": "Seoul" }' } });
    expect(screen.queryByText('JSON 형식이 아닙니다')).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith({ city: 'Seoul' });
  });

  it('입력 중에 바깥 값이 바뀌면 입력 칸을 그 값으로 다시 맞춘다', () => {
    render(
      <Harness
        kind="json"
        initial={{}}
        outside={{ city: 'Busan' }}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText<HTMLTextAreaElement>('테스트 입력');
    fireEvent.change(input, { target: { value: '{ "city": ' } });

    fireEvent.click(screen.getByText('바깥에서 바꾸기'));
    expect(JSON.parse(input.value)).toEqual({ city: 'Busan' });
    expect(screen.queryByText('JSON 형식이 아닙니다')).toBeNull();
  });
});

describe('KeyValueInput', () => {
  it('이름이 빈 줄은 저장하지 않고, 이름을 넣으면 저장한다', () => {
    const onChange = vi.fn();
    render(
      <Harness kind="keyValue" initial={{}} outside={{}} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '쿼리 추가' }));
    fireEvent.change(screen.getByLabelText('쿼리 1 값'), {
      target: { value: 'Seoul' },
    });
    expect(onChange).not.toHaveBeenCalled();
    // 저장하지 않아도 입력 중인 줄은 남는다.
    expect(screen.getByLabelText<HTMLInputElement>('쿼리 1 값').value).toBe(
      'Seoul',
    );

    fireEvent.change(screen.getByLabelText('쿼리 1 이름'), {
      target: { value: 'city' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ city: 'Seoul' });
  });

  it('바깥 값이 바뀌면 줄을 그 값으로 다시 맞춘다', () => {
    render(
      <Harness
        kind="keyValue"
        initial={{ city: 'Seoul' }}
        outside={{}}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText<HTMLInputElement>('쿼리 1 이름').value).toBe(
      'city',
    );

    fireEvent.click(screen.getByText('바깥에서 바꾸기'));
    expect(screen.queryByLabelText('쿼리 1 이름')).toBeNull();
  });
});
