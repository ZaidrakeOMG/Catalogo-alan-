-- GRIPXELL | Número oficial de WhatsApp para compras
-- Puedes ejecutar este SQL varias veces sin duplicar registros.
-- Enlace de prueba: https://wa.me/5218713285416
INSERT INTO public.gripxell_configuracion (id, whatsapp_numero)
VALUES (1, '5218713285416')
ON CONFLICT (id) DO UPDATE SET
  whatsapp_numero = EXCLUDED.whatsapp_numero;

SELECT id, nombre_tienda, whatsapp_numero
FROM public.gripxell_configuracion
WHERE id = 1;
