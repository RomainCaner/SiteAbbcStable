# Image legere basee sur Alpine Linux (~25 MB)
FROM nginx:alpine

# Supprime la page par defaut de nginx
RUN rm -rf /usr/share/nginx/html/*

# Copie tous les fichiers du site dans le repertoire servi par nginx
COPY . /usr/share/nginx/html

# Configuration nginx personnalisee (gzip, cache, headers securite)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Port HTTP standard
EXPOSE 80

# Demarrage automatique de nginx au premier plan (mode Docker)
CMD ["nginx", "-g", "daemon off;"]
