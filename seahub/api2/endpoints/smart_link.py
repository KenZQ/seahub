# Copyright (c) 2012-2018 Seafile Ltd.
import os
import logging

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seaserv import seafile_api

from seahub.api2.utils import api_error
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle

from seahub.tags.models import FileUUIDMap
from seahub.utils import get_service_url, normalize_dir_path, \
        normalize_file_path
from seahub.utils.repo import is_valid_repo_id_format
from seahub.views import check_folder_permission

logger = logging.getLogger(__name__)


def gen_smart_link(dirent_uuid, dirent_name):

    service_url = get_service_url()
    service_url = service_url.rstrip('/')
    return '%s/smart-link/%s/%s' % (service_url, dirent_uuid, dirent_name)


class SmartLink(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """ Get smart link of a file/dir.
        """

        # argument check
        repo_id = request.GET.get('repo_id', None)
        if not repo_id or not is_valid_repo_id_format(repo_id):
            error_msg = 'repo_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        path = request.GET.get('path', None)
        if not path:
            error_msg = 'path invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        is_dir = request.GET.get('is_dir', None)
        if not is_dir:
            error_msg = 'is_dir invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        is_dir = is_dir.lower()
        if is_dir not in ('true', 'false'):
            error_msg = "is_dir can only be 'true' or 'false'."
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # resource check
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if is_dir == 'true':
            if not seafile_api.get_dir_id_by_path(repo_id, normalize_dir_path(path)):
                error_msg = 'Folder %s not found.' % path
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        else:
            if not seafile_api.get_file_id_by_path(repo_id, normalize_file_path(path)):
                error_msg = 'File %s not found.' % path
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check

        # make sure path:
        # 1. starts with '/'
        # 2. NOT ends with '/'
        path = normalize_file_path(path)

        parent_dir = os.path.dirname(path)
        if not check_folder_permission(request, repo_id, parent_dir):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # get file/dir uuid
        dirent_name = os.path.basename(path)

        # TODO virtual repo

        try:
            uuid_map = FileUUIDMap.objects.get_or_create_fileuuidmap(repo_id,
                    parent_dir, dirent_name, is_dir == 'true')
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        dirent_uuid = uuid_map.uuid
        smart_link = gen_smart_link(dirent_uuid, dirent_name)

        return Response({'smart_link': smart_link})