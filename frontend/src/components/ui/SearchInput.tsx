import { forwardRef } from 'react';
import { Search } from 'lucide-react';
import { Input, type InputProps } from './Input';

export type SearchInputProps = Omit<InputProps, 'leftIcon'>

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>((props, ref) => {
  return (
    <Input
      ref={ref}
      leftIcon={<Search size={18} className="text-tertiary" />}
      {...props}
    />
  );
});

SearchInput.displayName = 'SearchInput';
