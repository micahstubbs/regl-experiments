# safe
lebab --replace *.js--transform arrow
lebab --replace *.js--transform for-of
lebab --replace *.js--transform for-each
lebab --replace *.js--transform arg-rest
lebab --replace *.js--transform arg-spread
lebab --replace *.js--transform obj-method
lebab --replace *.js--transform obj-shorthand
lebab --replace *.js--transform multi-var
# unsafe
lebab --replace *.js--transform let
lebab --replace *.js--transform template