-- =============================================================================
-- JIUMP · Datos de prueba para desarrollo local (supabase db reset).
-- NO se aplica en producción.
--
-- Todo proviene del diseño aprobado y de design/fotos/README.md (fotos reales
-- de JIUMP, con su texto alternativo). No se inventa contenido institucional:
-- cuerpos de artículos, autores, fechas, lugares e introducciones quedan vacíos
-- hasta que JIUMP los entregue (docs/pendientes.md).
--
-- Las fotos se registran con la ruta diseno/<archivo>; para verlas en local,
-- súbelas con supabase/scripts/subir-fotos-diseno.sh.
-- Generado a partir de design/fotos/README.md.
-- =============================================================================

-- Fotos -----------------------------------------------------------------------
insert into public.fotos (id, archivo, ancho, alto, texto_alternativo) values
  ('ef37cff8-7971-54ef-ac1d-2b43bc6e733a', 'diseno/05238004edcc733d035cca963adbfdec.jpg', 1600, 1067, 'Músico tocando guitarra en la Convención Nacional JIUMP 2026'),
  ('6942ec3d-12c0-5919-851c-5a68a984ae95', 'diseno/0ec89f2b92b1a2e47af15f008f16f77e.jpg', 1600, 1066, 'Grupo de trabajo revisando una guía'),
  ('3c233757-6afb-5f9a-a9e3-a927d674b7ab', 'diseno/119f54b55111c02604ef19531dcb2361.jpg', 1600, 1059, 'Expositor hablando durante el EJZ 2026'),
  ('7864702a-76d4-5241-8fb5-38e23288c170', 'diseno/1228472d44f39e83ee5ba831884a6f1e.jpg', 1600, 1059, 'Asistentes toman apuntes'),
  ('99885c57-576b-5b58-b8e7-f17084778a6f', 'diseno/12e708880533fae39418bacf4f5f8bd1.jpg', 1600, 1066, 'Participante sonríe junto a su maestra durante el test de estilos de aprendizaje'),
  ('a85ac4f5-16c3-5835-852f-03c640158ce0', 'diseno/1b16c658d676a48f9564e3144cfa63aa.png', 640, 568, 'Logo JIUMP a color'),
  ('5f0177d5-3c8d-56b9-a844-b5f6b5484143', 'diseno/1b9e9abed25d0de0cf2d1f72ec5096d4.jpg', 1600, 1067, 'Expositor en el taller de adolescentes'),
  ('346d9049-3a4b-5693-890a-90e2e5f180b5', 'diseno/1c1556616113621811b72f1a72d9521e.jpg', 1200, 1600, 'Representación en el escenario'),
  ('c72e056f-5f2f-5501-a7f5-961ff68a0bf8', 'diseno/21015b077af42f800ba45bf472e455e0.jpg', 1066, 1600, 'Expositora hablando al micrófono'),
  ('1113f07f-2614-580e-b2f5-83fe81e3f791', 'diseno/25b550f1411f6c261cc0d42a3945ea92.jpg', 1600, 1067, 'Jóvenes y pastores adorando con las manos levantadas en la Convención'),
  ('dd07bbdf-a03b-5b38-a974-7cba2374ce42', 'diseno/333848e15e3839fcb0ce7ef26568f8f7.jpg', 1600, 1067, 'Joven sonriendo junto a otros jóvenes durante una actividad de JIUMP'),
  ('20c91b3d-5595-55e5-8b81-6e49d4011fd5', 'diseno/3694fcafbcf80b4bb4aceacfbf3235c0.jpg', 1600, 1066, 'Asistentes atentas a la exposición'),
  ('52782221-b1c8-5396-b85d-b16c62a3ea86', 'diseno/37b805dcd7dbc8be26f1fab5a2d456b0.jpg', 1920, 1081, 'Jóvenes de JIUMP sonriendo juntos en un encuentro'),
  ('5bab6f36-f241-5e66-a6eb-c49e51eb24c2', 'diseno/41c24f60d5fa1ad39db4a22e0dca3755.jpg', 1600, 1059, 'Cientos de mujeres reunidas en el gimnasio durante el EMJ 2026'),
  ('3356c32b-8d00-596e-8d21-715b1bd07cdf', 'diseno/41f587a900dd6fcc94cd4d9e093e0c73.jpg', 1600, 1066, 'Participantes de FEDI atentas durante una sesión de formación'),
  ('b6e9fcd0-de03-5d6a-864d-ecf2940c9390', 'diseno/471f6e830276abcba80d047ed5dbeafa.jpg', 1600, 1066, 'Dos participantes leen juntas al micrófono'),
  ('0202d841-206d-51ac-a5ef-2321f907a007', 'diseno/5bde26efb15f98720f914e82247fae6b.jpg', 1600, 900, 'Joven en oración durante la Convención'),
  ('7e078f96-2928-52a5-b003-fd51e840a65e', 'diseno/6241d30db312e8d18cada04768d40d9a.jpg', 1600, 900, 'Participantes en una sala de taller'),
  ('63ac687e-0247-526e-a2b0-3fea1da12118', 'diseno/62482a07364cbc3f25da1eb64305bca0.jpg', 1600, 1200, 'Mesa principal en el escenario'),
  ('411c3e6a-2c35-5e52-8fec-84bda727a871', 'diseno/6911b69003728e9d853741a1c5a4249f.jpg', 1600, 1066, 'Participantes toman notas'),
  ('6b3cfc41-f586-5e4a-96fe-36542cdf33bf', 'diseno/6bdcf2a4fbd967e7c1e87a19da8af333.jpg', 1067, 1600, 'Joven del equipo de protocolo'),
  ('a61090b0-3817-504b-bbc2-f71d6fcceaac', 'diseno/6c502d4451a163a64c9d0ad86f5b5ae6.jpg', 960, 1280, 'Afiche Reforma Protestante: 31 de octubre, Día de las Iglesias Evangélicas y Protestantes. «Mas el justo por la fe vivirá», Romanos 1:17'),
  ('9ca4df4c-7a4d-5696-9934-06c2cbed41ce', 'diseno/6eebca653ff6c5f7ec503ead1f64b43d.jpg', 1600, 1200, 'Vista del salón con las asistentes frente al escenario'),
  ('1369657f-c8b9-50cb-a403-a4063754aee1', 'diseno/72aae312cb67f44e54c021dec1783407.jpg', 1600, 1066, 'Tres participantes sonrientes en sus asientos'),
  ('8e7c7dce-06e7-521f-8ec0-48467869ed4e', 'diseno/784625ac3ebfe474ed6261cca016b8df.jpg', 1600, 900, 'Escenario de la Convención Nacional JIUMP 2026 con la pantalla Samuel, Heme aquí'),
  ('c48983f4-ecaa-55a4-bdb9-60c96ad1c1c6', 'diseno/7a7095197174d535d4d6259e2d54ebf0.jpg', 1600, 1066, 'Participante toma notas junto a otras asistentes'),
  ('5225df30-0dba-54ee-bda1-3f163dd80b68', 'diseno/7cf1bbd9172ac149aaa1e22cb312bcf2.jpg', 1600, 1066, 'Grupo de maestras conversando con apuntes sobre las sillas'),
  ('042a1eca-ab43-582b-b82c-d6ce2a471993', 'diseno/7e76ad743ad9592da3560f06b7aacd24.jpg', 1067, 1600, 'Joven del equipo de transmisión operando una cámara'),
  ('25944796-be25-50a9-92a2-1586d67e2d0b', 'diseno/858f2a47176a8c3ef862e5e801715af1.jpg', 1600, 900, 'Familia sonriente en el patio de la Convención'),
  ('e7db86eb-c6ef-5272-ae97-482dd2c2136f', 'diseno/8bca7add752793f99fee0b8753265af9.jpg', 1600, 1059, 'Asistentes atentas en las graderías con sus Biblias'),
  ('a3e241bb-8e0a-5ce3-ab83-edb5c5f7bb44', 'diseno/952b76408d86dd5fd4b9f09870b957f7.jpg', 1066, 1600, 'Cuaderno con apuntes de la formación'),
  ('2933e939-cd1c-589d-a175-fad1004bd777', 'diseno/9cb71b83c845546c451078ca60b86b94.jpg', 1600, 1066, 'Tres participantes posan juntas'),
  ('3c5ec9e4-b316-56d8-8b4a-f01b91baa178', 'diseno/9db95206484088f7ed4a1b711d873e50.jpg', 1600, 1066, 'Cuatro participantes trabajan en grupo'),
  ('69279585-c2ee-5ac8-964d-b93249ed1e43', 'diseno/a61a93fef1f7faeae53ef5f46d380003.jpg', 1600, 900, 'Grupo de jóvenes con sus credenciales en la Convención Nacional JIUMP 2026'),
  ('21b58da1-85e6-586d-bd05-193092c36a86', 'diseno/a8ee3977f10649b692fdd03264f49352.jpg', 1600, 900, 'Expositora sonriendo con micrófono'),
  ('ca0a45d0-0b91-54ac-a1f3-257d7aa512e1', 'diseno/aa8b5bfc6b53aece86afaa5d6c704994.jpg', 1600, 1066, 'Líderes de jefaturas conversando frente a la congregación durante el EJZ 2026'),
  ('e37cd31e-2878-5137-866d-b560acdb2da1', 'diseno/aef2a32523a1d42e5ebf906e8fb21327.jpg', 1066, 1600, 'Pendón de la actividad'),
  ('69bb0482-22ab-5e1c-9c71-3a9291103245', 'diseno/afcfad84c4336e40e837fa4ffda3753e.jpg', 1600, 1066, 'Maestra explica una hoja de trabajo'),
  ('c739105b-0fff-59c1-95d8-65c153928d0e', 'diseno/b52acadf3ac5ed39e10656a44122826f.jpg', 1600, 1067, 'Asistentes sonrientes en un taller'),
  ('9c46e1f8-4538-5f9e-bfdc-d507739fdd85', 'diseno/badb9633dcc1e36e4dae6fd0fd5eaa10.jpg', 1066, 1600, 'Afiche sobre un atril'),
  ('54bbb65a-6d86-529d-8302-13405e556ee7', 'diseno/c812a4cd24f206fc856b063660dee62d.jpg', 1600, 1059, 'Asistentes del Encuentro de Mujeres JIUMP 2026 frente al escenario'),
  ('b2c8e7ba-6af0-56c8-a7e4-9fdc4b97085b', 'diseno/ca7a6206502cf4c966ab00e8359470cc.jpg', 1600, 900, 'Equipo de bienvenida con tiaras y pañuelos'),
  ('b3cc7b02-cff4-5bc8-a782-d64c1e3b5ed5', 'diseno/db0c2611e98a7044788aa3869a3d21f9.png', 640, 568, 'Logo JIUMP en blanco'),
  ('e1027421-2dee-5979-9258-87396f2790c5', 'diseno/dff67bd0d51a94d3ac16cf71c5007fb7.jpg', 1600, 1066, 'Asistentes de pie en oración'),
  ('72e7ca03-968f-5bcd-b30d-f540f5ffaaec', 'diseno/e35bd4e9754b6589802b003ec8985b38.jpg', 1600, 900, 'Músico en el teclado durante la alabanza'),
  ('6ea1170d-953c-540f-bc3e-eff32f32a2ee', 'diseno/e5446b7c014c334fc19b1e7a665d1661.jpg', 1600, 1059, 'Tres líderes de pie frente al altar'),
  ('a2ef7732-6c39-5572-8df7-16bd1d39291b', 'diseno/fbcb01fae53712385fd7ea5427abae4f.jpg', 1600, 1066, 'Participante escribe en su cuaderno');

-- Series y temas ----------------------------------------------------------------
insert into public.series (id, nombre, slug, descripcion, tipo, mes, color, icono, orden) values
  ('a0000000-0000-4000-8000-000000000001', 'Mes de la Biblia', 'mes-de-la-biblia',
   'Un recorrido por la historia de las Escrituras: su origen, la formación del canon, su paso de los rollos a la imprenta y su llegada a nuestro idioma.',
   'mes', 9, 'azul', 'libro', 1),
  ('a0000000-0000-4000-8000-000000000002', 'Mes de la Reforma Protestante', 'mes-de-la-reforma',
   'Por qué fue necesaria la Reforma, lo que costó defender la verdad y cómo su mensaje sigue hablándonos hoy.',
   'mes', 10, 'rojo', 'antorcha', 2),
  ('a0000000-0000-4000-8000-000000000003', 'Los Atributos de Dios', 'los-atributos-de-dios', null, 'tematica', null, 'neutro', null, 3),
  ('a0000000-0000-4000-8000-000000000004', 'Ven y Sígueme', 'ven-y-sigueme', null, 'tematica', null, 'neutro', null, 4),
  ('a0000000-0000-4000-8000-000000000005', 'Nehemías: Un espíritu encendido', 'nehemias-un-espiritu-encendido', null, 'tematica', null, 'neutro', null, 5),
  ('a0000000-0000-4000-8000-000000000006', 'Pactos de Dios', 'pactos-de-dios', null, 'tematica', null, 'neutro', null, 6);

insert into public.temas (nombre, slug) values
  ('Teología para todos', 'teologia-para-todos'),
  ('Problemáticas juveniles', 'problematicas-juveniles'),
  ('Ansiedad, preocupación y temor', 'ansiedad-preocupacion-y-temor'),
  ('Oración', 'oracion');

-- Artículos (títulos del diseño; cuerpo y autor pendientes) ----------------------
-- La Parte 2 de la Reforma queda «en revisión»: su título final está pendiente.
insert into public.articulos (id, titulo, slug, serie_id, parte, portada_foto_id, estado) values
  ('b0000000-0000-4000-8000-000000000001', '¿Cómo comenzó la Biblia?', 'como-comenzo-la-biblia', 'a0000000-0000-4000-8000-000000000001', 1, null, 'publicado'),
  ('b0000000-0000-4000-8000-000000000002', 'El nacimiento del canon bíblico', 'el-nacimiento-del-canon-biblico', 'a0000000-0000-4000-8000-000000000001', 2, null, 'publicado'),
  ('b0000000-0000-4000-8000-000000000003', 'De los rollos a la imprenta', 'de-los-rollos-a-la-imprenta', 'a0000000-0000-4000-8000-000000000001', 3, null, 'publicado'),
  ('b0000000-0000-4000-8000-000000000004', 'De Jerusalén a nuestro idioma', 'de-jerusalen-a-nuestro-idioma', 'a0000000-0000-4000-8000-000000000001', 4, null, 'publicado'),
  ('b0000000-0000-4000-8000-000000000005', '¿Por qué fue necesaria la Reforma?', 'por-que-fue-necesaria-la-reforma', 'a0000000-0000-4000-8000-000000000002', 1, 'a61090b0-3817-504b-bbc2-f71d6fcceaac', 'publicado'),
  ('b0000000-0000-4000-8000-000000000006', 'Cuando la verdad tuvo un precio', 'cuando-la-verdad-tuvo-un-precio', 'a0000000-0000-4000-8000-000000000002', 2, 'a61090b0-3817-504b-bbc2-f71d6fcceaac', 'revision'),
  ('b0000000-0000-4000-8000-000000000007', 'Una Reforma que todavía nos habla', 'una-reforma-que-todavia-nos-habla', 'a0000000-0000-4000-8000-000000000002', 3, 'a61090b0-3817-504b-bbc2-f71d6fcceaac', 'publicado');

-- Actividades 2026 (las cuatro del diseño; fechas, lugar e introducción pendientes)
insert into public.actividades (id, titulo, slug, tipo, anio, portada_foto_id, estado, destacar_inicio, orden_inicio) values
  ('c0000000-0000-4000-8000-000000000001', 'Convención Nacional JIUMP 2026', 'convencion-nacional-2026', 'convencion', 2026, '1113f07f-2614-580e-b2f5-83fe81e3f791', 'publicado', true, 1),
  ('c0000000-0000-4000-8000-000000000002', 'Encuentro de Mujeres JIUMP 2026', 'emj-2026', 'mujeres', 2026, 'b2c8e7ba-6af0-56c8-a7e4-9fdc4b97085b', 'publicado', true, 2),
  ('c0000000-0000-4000-8000-000000000003', 'Encuentro de Jefaturas 2026', 'ejz-2026', 'encuentro', 2026, '3c233757-6afb-5f9a-a9e3-a927d674b7ab', 'publicado', true, 3),
  ('c0000000-0000-4000-8000-000000000004', 'Formación de Maestros de Escuela Dominical Infantil 2026', 'fedi-2026', 'formacion', 2026, '99885c57-576b-5b58-b8e7-f17084778a6f', 'publicado', true, 4);

insert into public.actividad_fotos (actividad_id, foto_id, orden) values
  ('c0000000-0000-4000-8000-000000000001', 'ef37cff8-7971-54ef-ac1d-2b43bc6e733a', 1),
  ('c0000000-0000-4000-8000-000000000001', 'a85ac4f5-16c3-5835-852f-03c640158ce0', 2),
  ('c0000000-0000-4000-8000-000000000001', '5f0177d5-3c8d-56b9-a844-b5f6b5484143', 3),
  ('c0000000-0000-4000-8000-000000000001', '1113f07f-2614-580e-b2f5-83fe81e3f791', 4),
  ('c0000000-0000-4000-8000-000000000001', '0202d841-206d-51ac-a5ef-2321f907a007', 5),
  ('c0000000-0000-4000-8000-000000000001', '7e078f96-2928-52a5-b003-fd51e840a65e', 6),
  ('c0000000-0000-4000-8000-000000000001', '6b3cfc41-f586-5e4a-96fe-36542cdf33bf', 7),
  ('c0000000-0000-4000-8000-000000000001', '8e7c7dce-06e7-521f-8ec0-48467869ed4e', 8),
  ('c0000000-0000-4000-8000-000000000001', '042a1eca-ab43-582b-b82c-d6ce2a471993', 9),
  ('c0000000-0000-4000-8000-000000000001', '25944796-be25-50a9-92a2-1586d67e2d0b', 10),
  ('c0000000-0000-4000-8000-000000000001', '69279585-c2ee-5ac8-964d-b93249ed1e43', 11),
  ('c0000000-0000-4000-8000-000000000001', 'c739105b-0fff-59c1-95d8-65c153928d0e', 12),
  ('c0000000-0000-4000-8000-000000000001', '72e7ca03-968f-5bcd-b30d-f540f5ffaaec', 13),
  ('c0000000-0000-4000-8000-000000000002', '7864702a-76d4-5241-8fb5-38e23288c170', 1),
  ('c0000000-0000-4000-8000-000000000002', 'a85ac4f5-16c3-5835-852f-03c640158ce0', 2),
  ('c0000000-0000-4000-8000-000000000002', '5bab6f36-f241-5e66-a6eb-c49e51eb24c2', 3),
  ('c0000000-0000-4000-8000-000000000002', 'e7db86eb-c6ef-5272-ae97-482dd2c2136f', 4),
  ('c0000000-0000-4000-8000-000000000002', '21b58da1-85e6-586d-bd05-193092c36a86', 5),
  ('c0000000-0000-4000-8000-000000000002', '54bbb65a-6d86-529d-8302-13405e556ee7', 6),
  ('c0000000-0000-4000-8000-000000000002', 'b2c8e7ba-6af0-56c8-a7e4-9fdc4b97085b', 7),
  ('c0000000-0000-4000-8000-000000000003', '3c233757-6afb-5f9a-a9e3-a927d674b7ab', 1),
  ('c0000000-0000-4000-8000-000000000003', 'a85ac4f5-16c3-5835-852f-03c640158ce0', 2),
  ('c0000000-0000-4000-8000-000000000003', 'c48983f4-ecaa-55a4-bdb9-60c96ad1c1c6', 3),
  ('c0000000-0000-4000-8000-000000000003', 'ca0a45d0-0b91-54ac-a1f3-257d7aa512e1', 4),
  ('c0000000-0000-4000-8000-000000000003', '6ea1170d-953c-540f-bc3e-eff32f32a2ee', 5),
  ('c0000000-0000-4000-8000-000000000004', '6942ec3d-12c0-5919-851c-5a68a984ae95', 1),
  ('c0000000-0000-4000-8000-000000000004', '99885c57-576b-5b58-b8e7-f17084778a6f', 2),
  ('c0000000-0000-4000-8000-000000000004', 'a85ac4f5-16c3-5835-852f-03c640158ce0', 3),
  ('c0000000-0000-4000-8000-000000000004', 'c72e056f-5f2f-5501-a7f5-961ff68a0bf8', 4),
  ('c0000000-0000-4000-8000-000000000004', '20c91b3d-5595-55e5-8b81-6e49d4011fd5', 5),
  ('c0000000-0000-4000-8000-000000000004', '3356c32b-8d00-596e-8d21-715b1bd07cdf', 6),
  ('c0000000-0000-4000-8000-000000000004', 'b6e9fcd0-de03-5d6a-864d-ecf2940c9390', 7),
  ('c0000000-0000-4000-8000-000000000004', '411c3e6a-2c35-5e52-8fec-84bda727a871', 8),
  ('c0000000-0000-4000-8000-000000000004', '1369657f-c8b9-50cb-a403-a4063754aee1', 9),
  ('c0000000-0000-4000-8000-000000000004', '5225df30-0dba-54ee-bda1-3f163dd80b68', 10),
  ('c0000000-0000-4000-8000-000000000004', 'a3e241bb-8e0a-5ce3-ab83-edb5c5f7bb44', 11),
  ('c0000000-0000-4000-8000-000000000004', '2933e939-cd1c-589d-a175-fad1004bd777', 12),
  ('c0000000-0000-4000-8000-000000000004', '3c5ec9e4-b316-56d8-8b4a-f01b91baa178', 13),
  ('c0000000-0000-4000-8000-000000000004', 'e37cd31e-2878-5137-866d-b560acdb2da1', 14),
  ('c0000000-0000-4000-8000-000000000004', '69bb0482-22ab-5e1c-9c71-3a9291103245', 15),
  ('c0000000-0000-4000-8000-000000000004', '9c46e1f8-4538-5f9e-bfdc-d507739fdd85', 16),
  ('c0000000-0000-4000-8000-000000000004', 'e1027421-2dee-5979-9258-87396f2790c5', 17),
  ('c0000000-0000-4000-8000-000000000004', 'a2ef7732-6c39-5572-8df7-16bd1d39291b', 18);

-- Álbumes de la Galería del diseño ---------------------------------------------
-- Solo el de la Convención tiene fotos; los demás quedan en borrador
-- («Fotos próximamente»).
insert into public.albumes (id, titulo, slug, anio, pais, actividad_id, portada_foto_id, estado, orden) values
  ('d0000000-0000-4000-8000-000000000001', 'Convención Nacional 2026', 'convencion-nacional-2026', 2026, null, 'c0000000-0000-4000-8000-000000000001', '8e7c7dce-06e7-521f-8ec0-48467869ed4e', 'publicado', 1),
  ('d0000000-0000-4000-8000-000000000002', 'Encuentro de Mujeres JIUMP · Argentina', 'encuentro-de-mujeres-argentina', null, 'Argentina', null, null, 'borrador', 2),
  ('d0000000-0000-4000-8000-000000000003', '50 años JIUMP', '50-anios-jiump', null, null, null, null, 'borrador', 3),
  ('d0000000-0000-4000-8000-000000000004', 'Encuentro de Jefaturas 2025', 'encuentro-de-jefaturas-2025', 2025, null, null, null, 'borrador', 4);

insert into public.album_fotos (album_id, foto_id, orden) values
  ('d0000000-0000-4000-8000-000000000001', 'ef37cff8-7971-54ef-ac1d-2b43bc6e733a', 1),
  ('d0000000-0000-4000-8000-000000000001', 'a85ac4f5-16c3-5835-852f-03c640158ce0', 2),
  ('d0000000-0000-4000-8000-000000000001', '5f0177d5-3c8d-56b9-a844-b5f6b5484143', 3),
  ('d0000000-0000-4000-8000-000000000001', '1113f07f-2614-580e-b2f5-83fe81e3f791', 4),
  ('d0000000-0000-4000-8000-000000000001', '0202d841-206d-51ac-a5ef-2321f907a007', 5),
  ('d0000000-0000-4000-8000-000000000001', '7e078f96-2928-52a5-b003-fd51e840a65e', 6),
  ('d0000000-0000-4000-8000-000000000001', '6b3cfc41-f586-5e4a-96fe-36542cdf33bf', 7),
  ('d0000000-0000-4000-8000-000000000001', '8e7c7dce-06e7-521f-8ec0-48467869ed4e', 8),
  ('d0000000-0000-4000-8000-000000000001', '042a1eca-ab43-582b-b82c-d6ce2a471993', 9),
  ('d0000000-0000-4000-8000-000000000001', '69279585-c2ee-5ac8-964d-b93249ed1e43', 10),
  ('d0000000-0000-4000-8000-000000000001', '72e7ca03-968f-5bcd-b30d-f540f5ffaaec', 11);

-- Video de los 50 años (título y descripción pendientes: queda en borrador) ----
insert into public.videos (url, titulo, album_id, estado) values
  ('https://www.youtube.com/watch?v=XIn6jmUKxH0', 'Video 50 años JIUMP (título pendiente)', 'd0000000-0000-4000-8000-000000000003', 'borrador');

-- El registro de actividad no debe arrastrar la carga de prueba.
truncate public.registro_actividad;

